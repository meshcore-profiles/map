// Link that adds a contact in the official MeshCore app (also used as the QR code value).
export const buildContactUrl = node => {
	const params = new URLSearchParams({ name: node.adv_name, public_key: node.public_key, type: node.type });
	return `meshcore://contact/add?${params.toString()}`;
};
