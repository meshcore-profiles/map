import { Animated, Modal, Pressable, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
	dim: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
});

// The window every overlay (sheets, dialogs, menus, tooltips) lives in: transparent and drawn under the system bars, so the dim covers the whole screen.
export const OverlayModal = ({ visible = true, animationType = 'none', onRequestClose, children }) => (
	<Modal visible={visible} transparent animationType={animationType} onRequestClose={onRequestClose} statusBarTranslucent navigationBarTranslucent>
		{children}
	</Modal>
);

// Fills the overlay and closes it on tap. dimmed darkens the screen behind (sheets and dialogs); menus and tooltips keep it clear.
// opacity: an Animated value when the caller fades the dim itself (the sheets slide in).
export const Backdrop = ({ onPress, label, dimmed = true, opacity }) => (
	<Animated.View style={[StyleSheet.absoluteFill, dimmed && styles.dim, opacity && { opacity }]}>
		<Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityLabel={label} />
	</Animated.View>
);
