import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import emailValidator from '@sefinek/email-validator';
import { createConnection } from 'mongoose';
import nodemailer from 'nodemailer';
import TesterSignup from '../apps/web/models/testerSignup.model.js';

const DEFAULT_LANGUAGE = 'pl';
const DEFAULT_FROM_NAME = '';
const MESSAGE_ID_DOMAIN = 'meshcorepolska.org';
const installUrl = 'https://play.google.com/store/apps/details?id=com.sefinek.meshcoremap';
const telemavixUrl = 'https://sefinek.net/pl/projects/telemavix';
const privacyUrl = 'https://sefinek.net/pl/projects/meshcore/map/mobile-app/privacy-policy';
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

Życzymy miłego dnia,
Zespół MeshCore Polska`;
const invitation = { subject: SUBJECT, text: MESSAGE_TEXT };
const INVITATIONS = { pl: invitation, en: invitation };

const EXPORT_FILENAME = 'mcmap-testers.csv';

const HELP = `Usage: node tools/notify-testers.js [options]
  --send               Send email. By default, list the selected recipients.
  --limit N            Process at most N recipients, oldest signups first.
  --recipients FILE    Restrict to addresses in a CSV with one email per line.
  --export [FILE]      Export tester addresses regardless of invitation status (default: tools/${EXPORT_FILENAME}).
  --reply FILE         Send UTF-8 text as a reply in each invitation thread.
  --help               Show this help.`;

const escapeHtml = text => text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const toHtml = text => {
	const html = text.split(/(https?:\/\/[^\s<>"']+)/u).map((part, index) => {
		const escaped = escapeHtml(part);
		return index % 2 ? `<a href="${escaped}">${escaped}</a>` : escaped;
	}).join('');
	return `<p>${html.replace(/\r?\n(\r?\n)?/gu, (_, paragraphBreak) => paragraphBreak ? '</p>\n<p>' : '<br>')}</p>`;
};

const requiredEnv = (...names) => {
	const missing = names.filter(name => !process.env[name]);
	if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
};

const recipientLanguage = language => language === 'pl' || language === 'en' ? language : DEFAULT_LANGUAGE;

const sendMessages = async (signups, recipients, reply) => {
	requiredEnv('MAILER_HOST', 'MAILER_PORT', 'MAILER_AUTH_USER', 'MAILER_AUTH_PASSWD');
	const port = Number(process.env.MAILER_PORT);
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid MAILER_PORT.');
	const user = process.env.MAILER_AUTH_USER;
	const configuredFrom = process.env.MAILER_FROM?.trim();
	const from = configuredFrom?.includes('@') ? configuredFrom : { name: configuredFrom || DEFAULT_FROM_NAME, address: user };
	const transporter = nodemailer.createTransport({
		host: process.env.MAILER_HOST,
		port,
		secure: port === 465,
		requireTLS: port !== 465,
		auth: { user, pass: process.env.MAILER_AUTH_PASSWD },
	});
	await transporter.verify();

	let sent = 0;
	let failed = 0;
	const isReply = reply !== null;
	for (const [index, recipient] of recipients.entries()) {
		if (index > 0) await delay(1000);
		const { _id, email, language, threadMessageId } = recipient;
		const log = `[${index + 1}/${recipients.length}] ${email}`;
		const invitation = INVITATIONS[recipientLanguage(language)];
		const text = reply ?? invitation.text;
		const messageId = `<${randomUUID()}@${MESSAGE_ID_DOMAIN}>`;
		const claim = { _id, notificationClaim: messageId };
		if (!isReply) {
			const { modifiedCount } = await signups.updateOne({ _id, notifiedAt: null, notificationClaim: null },
				{ $set: { notificationClaim: messageId } });
			if (!modifiedCount) {
				console.log(`${log}: already sent or claimed.`);
				continue;
			}
		}

		let info;
		try {
			info = await transporter.sendMail({
				from, to: { address: email }, messageId, text, html: toHtml(text),
				subject: isReply ? `Re: ${invitation.subject}` : invitation.subject,
				...(isReply && { inReplyTo: threadMessageId, references: threadMessageId }),
			});
			if (info.accepted?.length !== 1) throw new Error('SMTP did not confirm acceptance.');
		} catch (err) {
			failed++;
			console.error(`${log}: ${err.message} (${messageId})`);
			if (!isReply && err.responseCode >= 400 && err.responseCode < 600) {
				await signups.updateOne(claim, { $unset: { notificationClaim: '' } });
			} else if (!isReply) {
				console.error(`${log}: delivery uncertain. The invitation is held for review.`);
			}
			continue;
		}

		sent++;
		if (!isReply) {
			try {
				const { modifiedCount } = await signups.updateOne(claim, {
					$set: { notifiedAt: new Date(), threadMessageId: info.messageId },
					$unset: { notificationClaim: '' },
					$currentDate: { updatedAt: true },
				});
				if (!modifiedCount) throw new Error('The signup no longer has the expected claim.');
			} catch (err) {
				failed++;
				console.error(`${log}: SMTP accepted ${info.messageId}, but MongoDB could not record it: ${err.message}`);
				continue;
			}
		}
		console.log(`${log}: accepted by SMTP (${info.messageId}).`);
	}

	console.log(`${sent} accepted by SMTP, ${failed} errors.`);
	return failed ? 1 : 0;
};

const main = async () => {
	const args = process.argv.slice(2);
	const exportIndex = args.indexOf('--export');
	if (exportIndex !== -1 && (args[exportIndex + 1] ?? '--').startsWith('-')) {
		args[exportIndex] = `--export=${join(import.meta.dirname, EXPORT_FILENAME)}`;
	}
	const { values: options } = parseArgs({
		args,
		options: {
			send: { type: 'boolean' },
			limit: { type: 'string' },
			recipients: { type: 'string' },
			export: { type: 'string' },
			reply: { type: 'string' },
			help: { type: 'boolean' },
		},
	});
	if (options.help) {
		console.log(HELP);
		return 0;
	}

	const limit = Number(options.limit ?? 0);
	if (options.limit !== undefined && (!(/^\d+$/u).test(options.limit) || !Number.isSafeInteger(limit) || limit < 1)) {
		throw new Error('--limit requires a positive integer.');
	}
	if (options.export !== undefined && (options.send || options.reply !== undefined || options.recipients !== undefined)) {
		throw new Error('--export cannot be combined with --send, --reply or --recipients.');
	}
	const reply = options.reply === undefined ? null : (await readFile(options.reply, 'utf8')).trim();
	if (reply === '') throw new Error('The reply file is empty.');
	const emails = options.recipients === undefined ? null : [...new Set((await readFile(options.recipients, 'utf8'))
		.split(/\r?\n/u).map(line => line.trim().toLowerCase()).filter(Boolean))];
	if (emails && (!emails.length || emails.some(email => !emailValidator(email)))) {
		throw new Error('The recipients CSV must contain one valid email address per line, with no header.');
	}

	try {
		process.loadEnvFile(join(import.meta.dirname, '..', '.env'));
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}
	requiredEnv('MONGODB_URL');
	const connection = createConnection(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 5000 });
	try {
		await connection.asPromise();
		const signups = connection.db.collection(TesterSignup.collection.name);
		const filter = {};
		if (options.export === undefined) {
			if (reply === null) Object.assign(filter, { notifiedAt: null, notificationClaim: null });
			else filter.threadMessageId = { $type: 'string', $ne: '' };
		}
		if (emails) filter.email = { $in: emails };
		const recipients = await signups.find(filter, { projection: { email: 1, language: 1, threadMessageId: 1 } })
			.sort({ createdAt: 1, _id: 1 }).limit(limit).toArray();
		if (recipients.some(({ email }) => typeof email !== 'string' || !emailValidator(email))) {
			throw new Error('Invalid address in the signup list.');
		}
		console.log(`${recipients.length} recipient(s) selected.`);
		if (options.export !== undefined) {
			const addresses = new Set(recipients.map(({ email }) => email.toLowerCase()));
			const csv = [...addresses].map(email => `${email}\r\n`).join('');
			await writeFile(options.export, csv, { encoding: 'utf8', flag: 'wx' });
			console.log(`Exported to ${options.export}.`);
		} else if (!options.send) {
			for (const { email, language } of recipients) console.log(`  ${email} (${recipientLanguage(language)})`);
			console.log('Preview only. Add --send to deliver.');
		} else if (recipients.length) {
			const exitCode = await sendMessages(signups, recipients, reply);
			return exitCode;
		}
		return 0;
	} finally {
		await connection.close();
	}
};

main().then(code => {
	process.exitCode = code;
}).catch(err => {
	console.error(err.message);
	process.exitCode = 1;
});
