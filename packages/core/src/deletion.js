// The e-mail a node owner sends to have the node removed. The site prepares it on the server (after the captcha), the app builds it on the device.
export const DELETION_EMAIL = 'recrof+meshcore-map-delete@gmail.com';

const SUBJECT = 'MeshCore Map node deletion request';

// t: translation function (key => text); domain: the site the request is prepared on.
export const buildDeletionMailUrl = (publicKey, t, domain) => {
	const body = `Please delete my node(s) from MeshCore Map database.

MeshCore link(s) or public key(s):
${publicKey}

${t('map:deletion.mail.ownershipConfirmation')}

*** ${t('map:deletion.mail.instructionsTitle')} ***
${t('map:deletion.mail.instructions')}

// This request was prepared via https://${domain}.`;

	return `mailto:${DELETION_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
};
