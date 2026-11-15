import { useEffect, useRef } from 'react';
import { pointFromCoords, pointFromNode } from './points';

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
