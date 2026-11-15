import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { Sheet } from '../ui/Sheet';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	item: { minHeight: MIN_TOUCH + 12, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, justifyContent: 'center', gap: 2 },
	title: { color: colors.text, fontSize: 16, fontWeight: '600' },
	desc: { color: colors.textMuted, fontSize: 13 },
	disabled: { opacity: 0.45 },
});

// features comes from /api/v1/app-config; a missing entry means the tool is not switched off.
export const ToolsSheet = ({ visible, features, onSelect, onClose }) => {
	const { t } = useI18n();

	const tools = [
		{ id: 'measure', title: t('measure:title'), desc: t('measure:hint') },
		{ id: 'route', title: t('route:title'), desc: t('mobile:tools.routeDesc') },
		{ id: 'terrain', title: t('terrain:title'), desc: t('mobile:tools.needsNetwork'), feature: 'terrain' },
		{ id: 'coverage', title: t('coverage:title'), desc: t('mobile:tools.needsNetwork'), feature: 'coverage' },
	];

	return (
		<Sheet visible={visible} title={t('mobile:tools.title')} onClose={onClose}>
			<View style={{ gap: spacing.sm }}>
				{tools.map(tool => {
					const enabled = !tool.feature || features?.[tool.feature] !== false;
					return (
						<Pressable key={tool.id} disabled={!enabled} onPress={() => onSelect(tool.id)} accessibilityRole="button" accessibilityState={{ disabled: !enabled }} style={[styles.item, !enabled && styles.disabled]}>
							<Text style={styles.title}>{tool.title}</Text>
							<Text style={styles.desc}>{enabled ? tool.desc : t('common:toolUnavailable')}</Text>
						</Pressable>
					);
				})}
			</View>
		</Sheet>
	);
};
