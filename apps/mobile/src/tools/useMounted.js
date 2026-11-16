import { useEffect, useRef } from 'react';

// Async work of a tool (elevation downloads) can finish after the tool was closed; it must not draw on the map then.
export const useMounted = () => {
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	return mounted;
};
