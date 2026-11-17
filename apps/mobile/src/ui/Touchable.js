import { Pressable } from 'react-native';
import { haptics } from './haptics';

// Pressable with the app's touch feedback: a haptic of the given kind ('tap' for actions, 'select' for choices, null for none) and a button role by default.
export const Touchable = ({ onPress, haptic = 'tap', accessibilityRole = 'button', ...props }) => (
	<Pressable
		accessibilityRole={accessibilityRole}
		{...props}
		onPress={event => {
			if (haptic) haptics[haptic]();
			onPress?.(event);
		}}
	/>
);
