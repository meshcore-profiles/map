module.exports = (publicKey, t, domain) => {
	const subject = 'MeshCore Map node deletion request';
	const body = `Please delete my node(s) from MeshCore Map database.

MeshCore link(s) or public key(s):
${publicKey}

${t('map:deletion.mail.ownershipConfirmation')}

*** ${t('map:deletion.mail.instructionsTitle')} ***
${t('map:deletion.mail.instructions')}

// This request was prepared via https://${domain}.`;

	return `mailto:recrof@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
