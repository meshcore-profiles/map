import { unpack } from 'msgpackr';

export const loadNodes = async (apiBase, region = 'pl') => {
	const res = await fetch(`${apiBase}/api/v1/nodes?region=${region}`);
	if (!res.ok) throw new Error(`Nodes API returned ${res.status}`);

	return unpack(new Uint8Array(await res.arrayBuffer()));
};
