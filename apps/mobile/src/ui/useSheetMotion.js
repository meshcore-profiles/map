import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';

const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.8;

// Slide-in / slide-out and the swipe-down-to-dismiss gesture shared by the modal and the docked sheet.
// `translateY` equals the window height while hidden, so the sheet is always off-screen before it appears.
// animateOut: slide out when `visible` turns false (the docked sheet is closed by its parent too, e.g. a tap on the map); onExited then fires once it is off-screen.
export const useSheetMotion = ({ visible, onClose, animateOut = false, onExited }) => {
	const { height } = useWindowDimensions();
	const translateY = useRef(new Animated.Value(height)).current;
	const closing = useRef(false);
	const shown = useRef(false);
	const onCloseRef = useRef(onClose);
	const onExitedRef = useRef(onExited);
	const heightRef = useRef(height);
	onCloseRef.current = onClose;
	onExitedRef.current = onExited;
	heightRef.current = height;

	useEffect(() => {
		if (visible) {
			shown.current = true;
			closing.current = false;
			Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
			return;
		}

		if (animateOut && shown.current) {
			shown.current = false;
			closing.current = true;
			Animated.timing(translateY, { toValue: heightRef.current, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && onExitedRef.current?.());
			return;
		}

		shown.current = false;
		translateY.setValue(heightRef.current);
	}, [visible, animateOut, translateY]);

	const close = useCallback(() => {
		if (closing.current) return;

		closing.current = true;
		Animated.timing(translateY, { toValue: heightRef.current, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onCloseRef.current?.());
	}, [translateY]);

	const panHandlers = useMemo(() => {
		const snapBack = () => Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 20, useNativeDriver: true }).start();

		return PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
			onPanResponderTerminationRequest: () => false,
			onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
			onPanResponderRelease: (_, g) => {
				if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) close();
				else snapBack();
			},
			onPanResponderTerminate: snapBack,
		}).panHandlers;
	}, [translateY, close]);

	const backdropOpacity = useMemo(() => translateY.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: 'clamp' }), [translateY, height]);

	return { translateY, backdropOpacity, panHandlers, close };
};
