import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Height of the on-screen keyboard (0 while it is hidden). The keyboard covers the window instead of resizing it, so panels docked at the bottom have to lift themselves.
export const useKeyboardHeight = () => {
	const [height, setHeight] = useState(0);

	useEffect(() => {
		const show = Keyboard.addListener('keyboardDidShow', event => setHeight(event.endCoordinates.height));
		const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));

		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	return height;
};
