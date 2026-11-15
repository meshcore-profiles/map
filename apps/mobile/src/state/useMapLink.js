import { useEffect } from 'react';
import { Linking } from 'react-native';
import { parseMapLink } from '@meshcore-map/core/links';

export const useMapLink = onLink => {
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
