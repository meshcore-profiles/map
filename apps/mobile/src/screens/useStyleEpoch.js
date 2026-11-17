import { useCallback, useRef, useState } from 'react';

// The style that finished loading last and the number of successful loads. The native side drops layers that were queued for a style which never loaded (e.g. 403 before a fallback),
// so the layers mount only after a style is ready and are rebuilt for each new one: styleEpoch is 0 until the current mapStyle has loaded, then the load count (use it as a key).
export const useStyleEpoch = mapStyle => {
	const [loaded, setLoaded] = useState({ style: null, epoch: 0 });
	const mapStyleRef = useRef(mapStyle);
	mapStyleRef.current = mapStyle;

	// The layers belong to the style that loaded last. Once the style prop changes they are unmounted in that same render, before the native side swaps styles;
	// removing their images from the new style afterwards only logs warnings.
	const styleEpoch = loaded.style === mapStyle ? loaded.epoch : 0;
	const handleStyleLoaded = useCallback(() => setLoaded(current => ({ style: mapStyleRef.current, epoch: current.epoch + 1 })), []);

	return { styleEpoch, handleStyleLoaded };
};
