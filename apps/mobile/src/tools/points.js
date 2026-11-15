import { parseLatLng } from '@meshcore-map/core/geo';
import { resolveNodeByQuery } from '@meshcore-map/core/node-utils';

// A point picked or typed in a tool: { lat, lng, label } (label is the node name, null for a bare coordinate).
export const pointFromCoords = ({ lat, lng }) => ({ lat, lng, label: null });

export const pointFromNode = node => ({ lat: node.lat, lng: node.lon, label: node.adv_name, key: node.public_key, radio: node.params });

export const pointFromText = (text, nodes) => {
	const coords = parseLatLng(text);
	if (coords) return pointFromCoords(coords);

	const node = resolveNodeByQuery(text, nodes);
	return node ? pointFromNode(node) : null;
};

export const describePoint = point => point.label ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
