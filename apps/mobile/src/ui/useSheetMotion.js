import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';

const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 0.8;
const TAP_SLOP = 4;
const RESIZE_DURATION = 240;
// How far ahead (ms) the release velocity is projected when picking the snap height, so a quick flick is enough to change it.
const VELOCITY_PROJECTION = 150;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Slide-in / slide-out and the swipe gestures shared by the modal sheet, the docked sheet and the tool panel.
// `translateY` equals the window height while hidden, so the sheet is always off-screen before it appears.
// animateOut: slide out when `visible` turns false (the docked sheet is closed by its parent too, e.g. a tap on the map); onExited then fires once it is off-screen.
// snaps (ascending heights, optional): the handle also resizes the sheet. `maxHeight` follows the finger and settles on the nearest snap, a tap on the handle
// goes to the next one (and wraps around). The lowest snap can be dragged further down to dismiss the sheet unless dismissable is false (the tool panel
// only collapses). Without snaps the sheet is just dismissed by swiping down.
export const useSheetMotion = ({ visible, onClose, animateOut = false, onExited, snaps, initialSnap = 0, dismissable = true }) => {
	const { height } = useWindowDimensions();
	const translateY = useRef(new Animated.Value(height)).current;
	const maxHeight = useRef(new Animated.Value(snaps?.[initialSnap] ?? 0)).current;
	const closing = useRef(false);
	const shown = useRef(false);
	const snapIndex = useRef(initialSnap);
	const startHeight = useRef(0);
	const onCloseRef = useRef(onClose);
	const onExitedRef = useRef(onExited);
	const heightRef = useRef(height);
	const snapsRef = useRef(snaps);
	const dismissableRef = useRef(dismissable);
	const initialSnapRef = useRef(initialSnap);
	onCloseRef.current = onClose;
	onExitedRef.current = onExited;
	heightRef.current = height;
	snapsRef.current = snaps;
	dismissableRef.current = dismissable;
	initialSnapRef.current = initialSnap;

	// The caller builds a new array on each render; the effects depend on its content.
	const snapsKey = snaps ? snaps.join(',') : '';

	// A new window size (rotation) re-applies the current snap at once.
	useEffect(() => {
		if (snapsRef.current) maxHeight.setValue(snapsRef.current[snapIndex.current]);
	}, [snapsKey, maxHeight]);

	useEffect(() => {
		if (visible) {
			shown.current = true;
			closing.current = false;
			snapIndex.current = initialSnapRef.current;
			if (snapsRef.current) maxHeight.setValue(snapsRef.current[snapIndex.current]);
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
	}, [visible, animateOut, translateY, maxHeight]);

	const close = useCallback(() => {
		if (closing.current) return;

		closing.current = true;
		Animated.timing(translateY, { toValue: heightRef.current, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onCloseRef.current?.());
	}, [translateY]);

	const panHandlers = useMemo(() => {
		const snapBack = () => Animated.spring(translateY, { toValue: 0, bounciness: 0, speed: 20, useNativeDriver: true }).start();

		// maxHeight is a layout property, so it cannot use the native driver; that is fine for a short transition.
		const settle = index => {
			snapIndex.current = index;
			Animated.timing(maxHeight, { toValue: snapsRef.current[index], duration: RESIZE_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
		};

		const nearestSnap = target => snapsRef.current.reduce((best, value, index) => (Math.abs(value - target) < Math.abs(snapsRef.current[best] - target) ? index : best), 0);

		return PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > TAP_SLOP && Math.abs(g.dy) > Math.abs(g.dx),
			onPanResponderTerminationRequest: () => false,
			onPanResponderGrant: () => {
				startHeight.current = snapsRef.current?.[snapIndex.current] ?? 0;
				maxHeight.stopAnimation(value => {
					startHeight.current = value;
				});
			},
			onPanResponderMove: (_, g) => {
				const list = snapsRef.current;
				if (!list) {
					translateY.setValue(Math.max(0, g.dy));
					return;
				}

				const lowest = list[0];
				if (g.dy > 0 && dismissableRef.current && startHeight.current <= lowest + 1) translateY.setValue(g.dy);
				else maxHeight.setValue(clamp(startHeight.current - g.dy, lowest, list[list.length - 1]));
			},
			onPanResponderRelease: (_, g) => {
				const list = snapsRef.current;
				const dismiss = g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY;

				if (!list) {
					if (dismiss) close();
					else snapBack();
					return;
				}

				if (Math.abs(g.dy) < TAP_SLOP && Math.abs(g.dx) < TAP_SLOP) {
					settle((snapIndex.current + 1) % list.length);
					return;
				}

				if (dismissableRef.current && startHeight.current <= list[0] + 1 && dismiss) {
					close();
					return;
				}

				settle(nearestSnap(startHeight.current - g.dy - g.vy * VELOCITY_PROJECTION));
				snapBack();
			},
			onPanResponderTerminate: () => {
				if (snapsRef.current) settle(snapIndex.current);
				snapBack();
			},
		}).panHandlers;
	}, [translateY, maxHeight, close]);

	const backdropOpacity = useMemo(() => translateY.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: 'clamp' }), [translateY, height]);

	return { translateY, backdropOpacity, panHandlers, close, maxHeight };
};
