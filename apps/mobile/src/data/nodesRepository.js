import { File } from 'expo-file-system';
import { unpack } from 'msgpackr';
import { prepareNodes } from '@meshcore-map/core/nodes';
import { fileOf, readJson, writeJson } from '../storage/files';

const nodesUrl = (apiBase, region) => `${apiBase}/api/v1/nodes?region=${region}`;
const dataName = region => `nodes-${region}.bin`;
const metaName = region => `nodes-${region}.json`;

// HEAD request: payload size and server-side data timestamp, without downloading.
export const fetchRegionInfo = async (apiBase, region, signal) => {
	const res = await fetch(nodesUrl(apiBase, region), { method: 'HEAD', signal });
	if (!res.ok) throw new Error(`Nodes API returned ${res.status}`);

	return { bytes: Number(res.headers.get('Content-Length')) || 0, updatedAt: res.headers.get('X-Data-Updated') };
};

export const hasCachedRegion = region => fileOf(dataName(region)).exists;

const decode = async region => {
	const file = fileOf(dataName(region));
	if (!file.exists) return null;

	const nodes = unpack(await file.bytes());
	return prepareNodes(nodes);
};

export const readCachedRegion = async region => {
	const meta = await readJson(metaName(region));
	if (!meta) return null;

	try {
		const index = await decode(region);
		return index && { ...index, ...meta };
	} catch (err) {
		console.error('Cached nodes are unreadable:', err);
		return null;
	}
};

// Downloads to a temp file and swaps the cache only on success, so an interrupted download never corrupts the offline copy.
export const downloadRegion = async (apiBase, region, { onProgress, signal } = {}) => {
	const tmp = fileOf(`${dataName(region)}.tmp`);
	try {
		await File.downloadFileAsync(nodesUrl(apiBase, region), tmp, { idempotent: true, onProgress, signal });
		await tmp.move(fileOf(dataName(region)), { overwrite: true });
	} finally {
		if (tmp.exists) tmp.delete();
	}

	const meta = { fetchedAt: Date.now() };
	await writeJson(metaName(region), meta);

	return { ...(await decode(region)), ...meta };
};
