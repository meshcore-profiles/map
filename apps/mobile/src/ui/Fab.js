import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../state/ThemeContext';
import { colors, shadow } from '../theme';
import { Icon } from './Icon';

const SIZE = 46;

const styles = StyleSheet.create({
	fab: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, ...shadow },
	pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});

// Round map button, same look as the website's #fab-stack.
export const Fab = ({ icon, label, onPress, primary }) => {
	const { accent, accentBright } = useTheme();

	return (
		<Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.fab, primary && { backgroundColor: accent, borderColor: accentBright }, pressed && styles.pressed]}>
			<Icon name={icon} size={22} color={primary ? '#fff' : colors.text} />
		</Pressable>
	);
};

export const FAB_SIZE = SIZE;