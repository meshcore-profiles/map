import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { parseMapLink } from '@meshcore-map/core/links';
import { toMaplibreView } from '@meshcore-map/core/sites';

const DEFAULT_LINK_ZOOM = 13;

// The links the app is opened with (initial URL and later ones): a map link is parsed and handed to onLink.
const useIncomingLink = onLink => {
	useEffect(() => {
		const handle = url => {
			const link = parseMapLink(url);
			if (link) onLink(link);
		};

		Linking.getInitialURL().then(handle).catch(err => console.warn('Could not read the initial link:', err));
		const subscription = Linking.addEventListener('url', ({ url }) => handle(url));

		return () => subscription.remove();
	}, [onLink]);
};

// Follows a map link: a link waits until the map is ready and, for a node, until that node is in the loaded data (it may still be downloading).
// onNode(node) shows a node, onView({ center, zoom }) moves the camera.
export const useMapLink = ({ ready, byKey, onNode, onView }) => {
	const [link, setLink] = useState(null);
	useIncomingLink(setLink);

	useEffect(() => {
		if (!link || !ready) return;

		if (link.node) {
			const node = byKey.get(link.node);
			if (!node) return;

			onNode(node);
		} else {
			onView(toMaplibreView({ lat: link.view.lat, lon: link.view.lon, zoom: link.view.zoom ?? DEFAULT_LINK_ZOOM }));
		}

		setLink(null);
	}, [link, ready, byKey, onNode, onView]);
};
