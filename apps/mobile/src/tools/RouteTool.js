import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistance } from '@meshcore-map/core/geo';
import { buildRoute } from '@meshcore-map/core/route';
import { useI18n } from '../i18n';
import { Button } from '../ui/Button';
import { Field, Hint } from '../ui/Field';
import { ToolPanel } from '../ui/ToolPanel';
import { colors, spacing } from '../theme';
import { boundsOf, buildPathFeatures } from './pathFeatures';

const styles = StyleSheet.create({
	row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
	rowText: { color: colors.text, flexShrink: 1 },
	rowValue: { color: colors.textMuted },
	rowError: { color: colors.redBright },
	total: { color: colors.text, fontSize: 18, fontWeight: '700' },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
	input: { minHeight: 64, textAlignVertical: 'top' },
});

const COLOR = colors.green;

export const RouteTool = ({ ctx }) => {
	const { t } = useI18n();
	const { nodes, setOverlay, fitTo, onClose } = ctx;
	const [input, setInput] = useState('');
	const [route, setRoute] = useState(null);

	useEffect(() => () => setOverlay(null), [setOverlay]);

	const draw = () => {
		const result = buildRoute(input, nodes);
		setRoute(result);
		setOverlay(buildPathFeatures(result.points, { color: COLOR, labelFor: p => p.label }));
		if (result.points.length > 0) fitTo(boundsOf(result.points));
	};

	const clear = () => {
		setInput('');
		setRoute(null);
		setOverlay(null);
	};

	let segmentIndex = 0;

	return (
		<ToolPanel icon="route" title={t('route:title')} onClose={onClose}>
			<Hint>{t('route:desc')}</Hint>
			<Field value={input} onChangeText={setInput} placeholder={t('route:inputPlaceholder')} multiline style={styles.input} />
			<View style={styles.actions}>
				<Button style={styles.action} label={t('route:draw')} disabled={!input.trim()} onPress={draw} />
				<Button style={styles.action} variant="ghost" label={t('common:clear')} onPress={clear} />
			</View>
			{route?.tokens.map((token, i) => {
				if (!token.node) {
					return (
						<View key={i} style={styles.row}>
							<Text style={[styles.rowText, styles.rowError]} numberOfLines={1}>{token.raw}</Text>
							<Text style={styles.rowError}>{t('route:notFound')}</Text>
						</View>
					);
				}

				const segment = route.segments[segmentIndex++];
				return (
					<View key={i} style={styles.row}>
						<Text style={styles.rowText} numberOfLines={1}>{token.node.adv_name}</Text>
						<Text style={styles.rowValue}>{segment ? formatDistance(segment.distance) : ''}</Text>
					</View>
				);
			})}
			{route && route.segments.length > 0 && <Text style={styles.total}>{t('route:total', { distance: formatDistance(route.total) })}</Text>}
		</ToolPanel>
	);
};
