import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, pill, shadow, spacing } from '../theme';
import { Icon } from './Icon';

// Below the search bar and the quick chips, so a toast never covers the map buttons in the corner.
const TOP_BAR_HEIGHT = 124;

const STATUS_COLORS = { error: colors.redBright, success: colors.green, info: colors.blue };
const STATUS_ICONS = { error: 'close', success: 'check', info: 'info' };

const styles = StyleSheet.create({
	container: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', gap: spacing.sm },
	toast: { ...pill, maxWidth: '100%', ...shadow },
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

	const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] });

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

// Module-level, so an id is never reused even if the provider is remounted (a reused id means two children with the same key).
let lastId = 0;

export const ToastProvider = ({ children }) => {
	const insets = useSafeAreaInsets();
	const [toasts, setToasts] = useState([]);

	// A toast with the same `group` replaces the previous one, so a chain of related events (basemaps failing one after another) shows a single message.
	const show = useCallback((message, { status = 'success', duration = 3000, group = null } = {}) => {
		const id = ++lastId;
		setToasts(current => [...(group ? current.filter(toast => toast.group !== group) : current), { id, message, status, duration, group }]);
	}, []);

	const remove = useCallback(id => setToasts(current => current.filter(toast => toast.id !== id)), []);

	return (
		<ToastContext.Provider value={show}>
			{children}
			<View pointerEvents="box-none" style={[styles.container, { top: insets.top + TOP_BAR_HEIGHT }]}>
				{toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDone={remove} />)}
			</View>
		</ToastContext.Provider>
	);
};

export const useToast = () => useContext(ToastContext);
