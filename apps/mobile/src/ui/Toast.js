import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, spacing } from '../theme';
import { Icon } from './Icon';

const STATUS_COLORS = { error: colors.redBright, success: colors.green, info: colors.blue };
const STATUS_ICONS = { error: 'close', success: 'check', info: 'info' };

const styles = StyleSheet.create({
	container: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', gap: 10 },
	toast: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '100%', paddingVertical: 10, paddingLeft: 12, paddingRight: 18, borderRadius: 999, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.panelSolid, ...shadow },
	text: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
});

const ToastItem = ({ toast, onDone }) => {
	const opacity = useRef(new Animated.Value(0)).current;
	const closing = useRef(false);

	const dismiss = useCallback(() => {
		if (closing.current) return;

		closing.current = true;
		Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onDone(toast.id));
	}, [opacity, onDone, toast.id]);

	useEffect(() => {
		Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
		const timer = setTimeout(dismiss, toast.duration);

		return () => clearTimeout(timer);
	}, [opacity, dismiss, toast.duration]);

	const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

	return (
		<Animated.View style={{ opacity, transform: [{ translateY }], maxWidth: '100%' }} accessibilityLiveRegion="polite">
			<Pressable style={styles.toast} onPress={dismiss} accessibilityRole="button" accessibilityLabel={toast.message}>
				<Icon name={STATUS_ICONS[toast.status] ?? 'info'} size={18} color={STATUS_COLORS[toast.status] ?? colors.blue} />
				<Text style={styles.text}>{toast.message}</Text>
			</Pressable>
		</Animated.View>
	);
};

const ToastContext = createContext(() => null);

export const ToastProvider = ({ children }) => {
	const insets = useSafeAreaInsets();
	const [toasts, setToasts] = useState([]);
	const counter = useRef(0);

	const show = useCallback((message, { status = 'success', duration = 3000 } = {}) => {
		const id = ++counter.current;
		setToasts(current => [...current, { id, message, status, duration }]);
	}, []);

	const remove = useCallback(id => setToasts(current => current.filter(toast => toast.id !== id)), []);

	return (
		<ToastContext.Provider value={show}>
			{children}
			<View pointerEvents="box-none" style={[styles.container, { bottom: insets.bottom + spacing.xl }]}>
				{toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDone={remove} />)}
			</View>
		</ToastContext.Provider>
	);
};

export const useToast = () => useContext(ToastContext);
