import { File } from 'expo-file-system';
import { unpack } from 'msgpackr';
import { prepareNodes } from '@meshcore-map/core/nodes';
import { fileOf, readJson, writeJson } from '../storage/files';
import { apiFetch, apiHeaders } from './http';

const nodesUrl = (apiBase, region) => `${apiBase}/api/v1/nodes?region=${region}`;
const dataName = region => `nodes-${region}.bin`;
const metaName = region => `nodes-${region}.json`;

// HEAD request: payload size and server-side data timestamp, without downloading.
export const fetchRegionInfo = async (apiBase, region, signal) => {
	const res = await apiFetch(nodesUrl(apiBase, region), { method: 'HEAD', signal });
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
	let moved = false;
	try {
		await File.downloadFileAsync(nodesUrl(apiBase, region), tmp, { idempotent: true, headers: apiHeaders(), onProgress, signal });
		// move() re-points the File instance at the destination, so the temp file must not be cleaned up after a successful move.
		await tmp.move(fileOf(dataName(region)), { overwrite: true });
		moved = true;
	} finally {
		if (!moved && tmp.exists) tmp.delete();
	}

	const index = await decode(region);
	if (!index) throw new Error('Downloaded nodes file is missing or empty.');

	const meta = { fetchedAt: Date.now() };
	await writeJson(metaName(region), meta);

	return { ...index, ...meta };
};
