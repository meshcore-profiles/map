import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, radius, shadow, spacing } from '../theme';
import { Button } from './Button';
import { Backdrop, OverlayModal } from './Overlay';

const MAX_WIDTH = 420;
const SIDE_BY_SIDE_MAX_LABEL = 16;

const styles = StyleSheet.create({
	root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
	dialog: { width: '100%', maxWidth: MAX_WIDTH, backgroundColor: colors.panelSolid, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadow },
	title: { color: colors.text, fontSize: 20, fontWeight: '700' },
	body: { gap: spacing.md },
	message: { color: colors.text, fontSize: 15, lineHeight: 22 },
	row: { flexDirection: 'row', gap: spacing.sm },
	column: { gap: spacing.sm },
	action: { flex: 1 },
});

// A centered dialog over a dimmed screen. actions: [{ label, onPress, variant }] in reading order, the last one is the main action;
// they sit side by side when the labels are short and stacked (main one on top) otherwise.
export const Dialog = ({ visible, title, onClose, children, actions = [] }) => {
	const { t } = useI18n();
	const { height } = useWindowDimensions();
	const stacked = actions.length > 2 || actions.some(action => action.label.length > SIDE_BY_SIDE_MAX_LABEL);
	const ordered = stacked ? [...actions].reverse() : actions;

	return (
		<OverlayModal visible={visible} animationType="fade" onRequestClose={onClose}>
			<View style={styles.root}>
				<Backdrop onPress={onClose} label={t('common:close')} />
				<View style={styles.dialog} accessibilityViewIsModal>
					<Text style={styles.title} accessibilityRole="header">{title}</Text>
					<ScrollView style={{ maxHeight: height * 0.6 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
					{actions.length > 0 && (
						<View style={stacked ? styles.column : styles.row}>
							{ordered.map(action => <Button key={action.label} style={stacked ? undefined : styles.action} variant={action.variant ?? 'secondary'} label={action.label} onPress={action.onPress} />)}
						</View>
					)}
				</View>
			</View>
		</OverlayModal>
	);
};

export const DialogText = ({ children }) => <Text style={styles.message}>{children}</Text>;

const DialogContext = createContext(null);

// Replacement for Alert.alert in the app's own look: confirm() resolves true/false, notify() shows a message with a single close button.
export const DialogProvider = ({ children }) => {
	const { t } = useI18n();
	const [current, setCurrent] = useState(null);
	const resolver = useRef(null);

	const open = useCallback(options => new Promise(resolve => {
		resolver.current = resolve;
		setCurrent(options);
	}), []);

	const settle = useCallback(result => {
		resolver.current?.(result);
		resolver.current = null;
		setCurrent(null);
	}, []);

	const api = useMemo(() => ({
		confirm: ({ title, message, confirmLabel, cancelLabel = t('common:cancel') }) => open({ title, message, confirmLabel, cancelLabel }),
		notify: ({ title, message }) => open({ title, message }),
	}), [open, t]);

	const actions = current?.confirmLabel
		? [{ label: current.cancelLabel, onPress: () => settle(false) }, { label: current.confirmLabel, variant: 'primary', onPress: () => settle(true) }]
		: [{ label: t('common:close'), onPress: () => settle(false) }];

	return (
		<DialogContext.Provider value={api}>
			{children}
			<Dialog visible={Boolean(current)} title={current?.title} onClose={() => settle(false)} actions={actions}>
				<DialogText>{current?.message}</DialogText>
			</Dialog>
		</DialogContext.Provider>
	);
};

export const useDialog = () => useContext(DialogContext);
