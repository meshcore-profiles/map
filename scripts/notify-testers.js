import '../loadEnv.js';
import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import connection from '../global/database/mongoose.js';
import TesterSignup from '../apps/web/models/testerSignup.model.js';

const DELAY_MS = 1000;

const args = process.argv.slice(2);
const send = args.includes('--send');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex === -1 ? 0 : Number.parseInt(args[limitIndex + 1], 10);
if (limitIndex !== -1 && !(limit > 0)) {
	console.error('--limit needs a positive number.');
	process.exit(1);
}
const replyIndex = args.indexOf('--reply');
const replyFile = replyIndex === -1 ? null : args[replyIndex + 1];
if (replyIndex !== -1 && (!replyFile || replyFile.startsWith('--'))) {
	console.error('--reply needs a path to a text file with the message body.');
	process.exit(1);
}
const installUrl = 'https://play.google.com/store/apps/details?id=com.sefinek.meshcoremap';
const telemavixUrl = 'https://sefinek.net/pl/projects/telemavix';
const privacyUrl = 'https://sefinek.net/pl/projects/meshcore/map/mobile-app/privacy-policy';
const escapeHtml = text => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const toHtml = text => text.split('\n\n').map(paragraph => `<p>${escapeHtml(paragraph).replace(/https?:\/\/[^\s<]*[^\s<.,;:!?)]/g, url => `<a href="${url}">${url}</a>`).replace(/\n/g, '<br>')}</p>`).join('\n');
const SUBJECT = 'MeshCore Map na Androida: zaproszenie do zamkniętych testów';
const MESSAGE_TEXT = `Cześć!

Dziękujemy za zgłoszenie do zamkniętych testów aplikacji MeshCore Map na Androida! Twój adres e-mail został dodany do listy testerów. Zapraszamy do sprawdzenia aplikacji i pomocy w jej przygotowaniu do publicznego wydania.

Aby dołączyć do testów, otwórz poniższy link na telefonie z Androidem. Upewnij się, że korzystasz z konta Google powiązanego z adresem e-mail podanym przy zgłoszeniu. Następnie potwierdź udział w testach i zainstaluj aplikację ze Sklepu Play:

${installUrl}

Jeśli nie widzisz możliwości dołączenia do testów lub instalacji aplikacji, sprawdź wybrane konto Google. Jeśli problem nadal występuje, odpisz na tę wiadomość, a pomożemy.

Testy potrwają 14 dni. Pozostań w programie testowym przez cały ten okres i regularnie korzystaj z aplikacji. Sprawdź, jak działa podczas przeglądania mapy i w codziennym użytkowaniu, oraz instaluj dostępne aktualizacje.

Pamiętaj, że to wersja testowa: może zawierać błędy, a niektóre funkcje mogą wymagać dopracowania. Stale pracujemy nad poprawkami, dlatego Twoje doświadczenia i zgłoszenia są dla nas szczególnie ważne.

Jeśli zauważysz błąd, coś będzie niejasne lub masz pomysł na usprawnienie, odpisz na tę wiadomość. Przy zgłaszaniu problemu podaj model telefonu, wersję Androida i opisz kroki prowadzące do jego wystąpienia. Jeśli możesz, dołącz też zrzut ekranu.

Przez cały okres testów będziemy informować Cię mailowo o postępach testów, nowych wersjach aplikacji i innych ważnych zmianach. Twój adres e-mail zostanie usunięty po zakończeniu testów. Możesz poprosić o jego usunięcie wcześniej, odpisując na tę wiadomość. Więcej o przetwarzaniu danych przeczytasz w polityce prywatności:
${privacyUrl}

Chcesz przetestować także Telemavix GPS na Androida? Aplikacja rejestruje trasy i dane z czujników telefonu, a z obsługiwanymi kamerami DJI Osmo Action działa też jako pilot GPS. Telemavix Studio na komputer pozwala dodawać te dane, mapę trasy i wskaźniki do nagrań z kamer sportowych oraz dronów. Więcej informacji, przykładowe filmy i zapisy do zamkniętych testów znajdziesz tutaj:
${telemavixUrl}

Dziękujemy za poświęcony czas!

Życzymy miłej niedzieli,
Zespół MeshCore Polska`;

const MESSAGE = {
	subject: SUBJECT,
	text: MESSAGE_TEXT,
	html: toHtml(MESSAGE_TEXT),
};
const resolveSender = () => {
	const configured = process.env.MAILER_FROM?.trim();
	if (!configured) return process.env.MAILER_AUTH_USER;

	return configured.includes('@') ? configured : { name: configured, address: process.env.MAILER_AUTH_USER };
};

const createTransporter = () => {
	const missing = ['MAILER_HOST', 'MAILER_PORT', 'MAILER_AUTH_USER', 'MAILER_AUTH_PASSWD'].filter(name => !process.env[name]);
	if (missing.length) throw new Error(`Missing in .env: ${missing.join(', ')}`);
	const port = Number(process.env.MAILER_PORT);

	return nodemailer.createTransport({
		host: process.env.MAILER_HOST,
		port,
		secure: port === 465,
		auth: { user: process.env.MAILER_AUTH_USER, pass: process.env.MAILER_AUTH_PASSWD },
	});
};

const buildReplyMessage = async () => {
	const text = (await readFile(replyFile, 'utf8')).trim();
	if (!text) throw new Error(`${replyFile} is empty.`);

	return {
		subject: `Re: ${SUBJECT}`,
		text,
		html: toHtml(text),
	};
};

const main = async () => {
	await connection.asPromise();

	const reply = replyFile ? await buildReplyMessage() : null;
	const filter = reply ? { threadMessageId: { $ne: null } } : { notifiedAt: null };
	const query = TesterSignup.find(filter).sort({ createdAt: 1 }).lean();
	if (limit) query.limit(limit);
	const recipients = await query;

	console.log(reply
		? `${recipients.length} ${recipients.length === 1 ? 'person' : 'people'} with a thread to reply in.`
		: `${recipients.length} ${recipients.length === 1 ? 'person' : 'people'} not written to yet.`);
	if (!send) {
		for (const { email } of recipients) console.log(`  ${email}`);
		console.log(reply ? 'Nothing was sent. Run with --send to send the reply in each thread.' : 'Nothing was sent. Run with --send to send the mail and mark them.');
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
			const headers = reply ? { inReplyTo: recipient.threadMessageId, references: recipient.threadMessageId } : {};
			const info = await transporter.sendMail({ from, to: recipient.email, ...(reply || MESSAGE), ...headers });
			if (!info.accepted?.length) throw new Error(`rejected by the server: ${info.response}`);

			sent++;
			console.log(`[${index + 1}/${recipients.length}] sent to ${recipient.email} (from ${info.envelope.from}, ${info.response}, ${info.messageId})`);

			if (!reply) {
				try {
					await TesterSignup.updateOne({ _id: recipient._id }, { $set: { notifiedAt: new Date(), threadMessageId: info.messageId } });
				} catch (err) {
					failed++;
					console.error(`MAIL WAS SENT but marking ${recipient.email} failed (it would get a duplicate on the next run; set notifiedAt and threadMessageId=${info.messageId} manually): ${err.message}`);
				}
			}
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
