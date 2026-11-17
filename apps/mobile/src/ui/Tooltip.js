import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '../theme';
import { haptics } from './haptics';

const GAP = 6;
const MIN_ROOM_ABOVE = 56;
const HIDE_AFTER_MS = 3000;

const styles = StyleSheet.create({
	bubble: { position: 'absolute', maxWidth: 260, backgroundColor: colors.panelSolid, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadow },
	text: { color: colors.text, fontSize: 13, fontWeight: '500' },
});

// The touch counterpart of a browser's "title" tooltip. Without onPress a tap shows it (an element that does nothing on its own, like a radio parameter chip);
// with onPress the action stays on tap and the tooltip moves to a long press. Style may be a function, like on Pressable.
export const Tooltip = ({ text, onPress, children, ...props }) => {
	const insets = useSafeAreaInsets();
	const { width: windowWidth, height: windowHeight } = useWindowDimensions();
	const ref = useRef(null);
	const [anchor, setAnchor] = useState(null);
	const [bubbleWidth, setBubbleWidth] = useState(null);

	const close = () => {
		setAnchor(null);
		setBubbleWidth(null);
	};

	const show = () => {
		haptics.select();
		ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
	};

	useEffect(() => {
		if (!anchor) return undefined;

		const timer = setTimeout(close, HIDE_AFTER_MS);
		return () => clearTimeout(timer);
	}, [anchor]);

	const bubbleStyle = () => {
		const left = bubbleWidth === null ? 0 : Math.min(Math.max(anchor.x + anchor.width / 2 - bubbleWidth / 2, spacing.sm), windowWidth - bubbleWidth - spacing.sm);
		const base = { left, opacity: bubbleWidth === null ? 0 : 1 };

		if (anchor.y - insets.top >= MIN_ROOM_ABOVE) return { ...base, bottom: windowHeight - anchor.y + GAP };

		return { ...base, top: anchor.y + anchor.height + GAP };
	};

	return (
		<>
			<Pressable ref={ref} collapsable={false} onPress={onPress ?? show} onLongPress={onPress ? show : undefined} accessibilityHint={onPress ? undefined : text} {...props}>
				{children}
			</Pressable>
			{anchor && (
				<Modal transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
					<Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={text} />
					<View style={[styles.bubble, bubbleStyle()]} pointerEvents="none" onLayout={event => setBubbleWidth(event.nativeEvent.layout.width)} accessibilityLiveRegion="polite">
						<Text style={styles.text}>{text}</Text>
					</View>
				</Modal>
			)}
		</>
	);
};
