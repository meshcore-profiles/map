import { useEffect, useRef } from 'react';
import { pointFromCoords, pointFromNode } from './points';

// Routes taps on the map and on nodes to `onPick` while `active`. The shared picker slot is released when the tool stops listening or unmounts.
export const useMapPicker = (setPicker, active, onPick) => {
	const onPickRef = useRef(onPick);
	onPickRef.current = onPick;

	useEffect(() => {
		if (!active) return undefined;

		setPicker({
			onMap: coords => onPickRef.current(pointFromCoords(coords)),
			onNode: node => onPickRef.current(pointFromNode(node)),
		});

		return () => setPicker(null);
	}, [active, setPicker]);
};
