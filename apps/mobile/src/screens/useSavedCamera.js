import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCamera, saveCamera } from '../storage/camera';

const SAVE_DELAY_MS = 500;

// The last map position: `savedCamera` is undefined while it loads, null when nothing usable is stored.
// `handleRegionDidChange` is the map's onRegionDidChange; it stores the view once the user stops moving.
export const useSavedCamera = () => {
	const [savedCamera, setSavedCamera] = useState(undefined);
	const timer = useRef(null);

	useEffect(() => {
		loadCamera().then(setSavedCamera).catch(() => setSavedCamera(null));
		return () => clearTimeout(timer.current);
	}, []);

	const handleRegionDidChange = useCallback(event => {
		const { center, zoom } = event.nativeEvent;

		clearTimeout(timer.current);
		timer.current = setTimeout(() => saveCamera({ center, zoom }).catch(err => console.error('Failed to save the camera:', err)), SAVE_DELAY_MS);
	}, []);

	return { savedCamera, handleRegionDidChange };
};
