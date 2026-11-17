const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

process.loadEnvFile(path.join(__dirname, '../.env'));

const { expo } = require('../apps/mobile/app.json');
const connection = require('../global/database/mongoose.js');
const TesterSignup = require('../apps/web/models/testerSignup.model.js');

const DELAY_MS = 2000;

const args = process.argv.slice(2);
const send = args.includes('--send');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex === -1 ? 0 : Number.parseInt(args[limitIndex + 1], 10);
if (limitIndex !== -1 && !(limit > 0)) {
	console.error('--limit needs a positive number.');
	process.exit(1);
}
const installUrl = process.env.TESTER_INSTALL_URL || `https://play.google.com/apps/testing/${expo.android.package}`;

const escapeHtml = text => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const SUBJECT = 'MeshCore Map na Androida: zaproszenie do zamkniętych testów';
const PARAGRAPHS = [
	'Cześć!',
	'Dziękujemy za zgłoszenie do zamkniętych testów aplikacji MeshCore Map na Androida! Twój adres e-mail został dodany do listy testerów. Zapraszamy do sprawdzenia aplikacji i pomocy w jej przygotowaniu do publicznego wydania.',
	'Aby dołączyć do testów, otwórz poniższy link na telefonie z Androidem. Upewnij się, że korzystasz z konta Google powiązanego z adresem e-mail podanym przy zgłoszeniu. Następnie zaakceptuj udział w teście i przejdź do instalacji aplikacji w Google Play:',
	installUrl,
	'Jeśli nie widzisz możliwości dołączenia do testów lub instalacji aplikacji, sprawdź wybrane konto Google. Jeśli problem nadal występuje, odpisz na tę wiadomość, a pomożemy.',
	'Testy potrwają 14 dni. Pozostań w programie testowym przez cały ten okres i regularnie korzystaj z aplikacji. Sprawdź, jak działa podczas przeglądania mapy i w codziennym użytkowaniu, oraz instaluj dostępne aktualizacje.',
	'Każda uwaga pomoże nam dopracować aplikację. Jeśli zauważysz błąd, coś będzie niejasne lub masz pomysł na usprawnienie, odpisz na tę wiadomość. Przy zgłaszaniu problemu podaj model telefonu, wersję Androida i opisz kroki prowadzące do jego wystąpienia. Jeśli możesz, dołącz też zrzut ekranu.',
	'Pamiętaj, że to wersja testowa: może zawierać błędy, a niektóre funkcje mogą wymagać dopracowania. Stale pracujemy nad poprawkami, dlatego Twoje doświadczenia i zgłoszenia są dla nas szczególnie ważne.',
	'Twój adres e-mail zostanie usunięty po zakończeniu testów. Możesz poprosić o jego usunięcie wcześniej, odpisując na tę wiadomość.',
	'Dziękujemy za poświęcony czas!',
	'Pozdrawiamy,',
	'Zespół MeshCore Polska',
];

const MESSAGE = {
	subject: SUBJECT,
	text: PARAGRAPHS.join('\n\n'),
	html: PARAGRAPHS.map(paragraph => paragraph === installUrl ? `<p><a href="${escapeHtml(installUrl)}">${escapeHtml(installUrl)}</a></p>` : `<p>${escapeHtml(paragraph)}</p>`).join('\n'),
};
const resolveSender = () => {
	const configured = process.env.MAILER_FROM?.trim();
	if (!configured) return process.env.MAILER_AUTH_USER;

	return configured.includes('@') ? configured : { name: configured, address: process.env.MAILER_AUTH_USER };
};

const createTransporter = () => {
	const missing = ['MAILER_HOST', 'MAILER_PORT', 'MAILER_AUTH_USER', 'MAILER_AUTH_PASSWD'].filter(name => !process.env[name]);
	if (missing.length) throw new Error(`Missing in .env: ${missing.join(', ')}`);
	const nodemailer = require('nodemailer');
	const port = Number(process.env.MAILER_PORT);

	return nodemailer.createTransport({
		host: process.env.MAILER_HOST,
		port,
		secure: port === 465,
		auth: { user: process.env.MAILER_AUTH_USER, pass: process.env.MAILER_AUTH_PASSWD },
	});
};

const main = async () => {
	await connection.asPromise();

	const query = TesterSignup.find({ notifiedAt: null }).sort({ createdAt: 1 }).lean();
	if (limit) query.limit(limit);
	const recipients = await query;

	console.log(`${recipients.length} ${recipients.length === 1 ? 'person' : 'people'} not written to yet.`);
	if (!send) {
		for (const { email } of recipients) console.log(`  ${email}`);
		console.log('Nothing was sent. Run with --send to send the mail and mark them.');
		return 0;
	}
	if (!recipients.length) return 0;

	const transporter = createTransporter();
	await transporter.verify();

	const from = resolveSender();
	let sent = 0;
	let failed = 0;

	for (const [index, recipient] of recipients.entries()) {
		if (index > 0) await sleep(DELAY_MS);

		try {
			const info = await transporter.sendMail({ from, to: recipient.email, ...MESSAGE });
			if (!info.accepted?.length) throw new Error(`rejected by the server: ${info.response}`);

			await TesterSignup.updateOne({ _id: recipient._id }, { $set: { notifiedAt: new Date() } });
			sent++;
			console.log(`[${index + 1}/${recipients.length}] sent to ${recipient.email} (from ${info.envelope.from}, ${info.response}, ${info.messageId})`);
		} catch (err) {
			failed++;
			console.error(`[${index + 1}/${recipients.length}] FAILED for ${recipient.email}: ${err.message}`);
		}
	}

	console.log(`Done: ${sent} sent, ${failed} failed (failed ones stay unmarked and will be retried on the next run).`);
	return failed ? 1 : 0;
};

main()
	.then(code => {
		process.exitCode = code;
	})
	.catch(err => {
		console.error(err);
		process.exitCode = 1;
	})
	.finally(() => connection.close());
