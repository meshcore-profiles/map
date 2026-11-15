import { useEffect, useRef } from 'react';
import { haptics } from '../ui/haptics';
import { pointFromCoords, pointFromNode } from './points';

export const useMapPicker = (setPicker, active, onPick) => {
	const onPickRef = useRef(onPick);
	onPickRef.current = onPick;

	useEffect(() => {
		if (!active) return undefined;

		setPicker({
			onMap: coords => {
				haptics.confirm();
				onPickRef.current(pointFromCoords(coords));
			},
			onNode: node => {
				haptics.confirm();
				onPickRef.current(pointFromNode(node));
			},
		});

		return () => setPicker(null);
	}, [active, setPicker]);
};
