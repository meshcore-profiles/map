import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { collectFilteredNodes, createDefaultFilters, NODE_TYPES, NODE_TYPE_KEYS } from '@meshcore-map/core/nodes';
import { isRadioValueSelected, RADIO_FILTER_KEYS, updateRadioSelection } from '@meshcore-map/core/radio-filter-utils';
import { useI18n } from '../i18n';
import { Button, Chip, ChipRow, Divider, Hint, Label, Stepper } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { colors, spacing, typeColors } from '../theme';

const styles = StyleSheet.create({
	summary: { color: colors.textMuted },
	footer: { flexDirection: 'row', gap: spacing.sm },
	footerButton: { flex: 1 },
	section: { gap: spacing.sm },
});

const RADIO_LABEL_KEYS = { freq: 'frequency', sf: 'sf', cr: 'cr', bw: 'bw' };
const DAY_PRESETS = [0, 1, 7, 30, 90];
const DAY_MS = 86400000;

const toDateString = days => (days ? new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10) : '');

// Stored date -> nearest "last N days" preset (0 = any time), so the chips reflect the current state.
const daysFromDate = value => {
	if (!value) return 0;

	const days = Math.round((Date.now() - new Date(value).getTime()) / DAY_MS);
	return DAY_PRESETS.filter(p => p > 0).reduce((best, p) => Math.abs(p - days) < Math.abs(best - days) ? p : best, DAY_PRESETS[1]);
};

const sortValues = values => [...values].toSorted((a, b) => a === 'unknown' ? 1 : b === 'unknown' ? -1 : Number(a) - Number(b));

// Filters are edited on a draft copy; the match count updates live and settings change only on "Apply".
export const FiltersSheet = ({ visible, filters, byType, radioOptions, total, onApply, onClose }) => {
	const { t } = useI18n();
	const [draft, setDraft] = useState(filters);

	const matching = useMemo(() => collectFilteredNodes(draft, byType).length, [draft, byType]);

	const toggleType = type => setDraft(current => ({
		...current,
		nodeFilter: current.nodeFilter.includes(type) ? current.nodeFilter.filter(item => item !== type) : [...current.nodeFilter, type],
	}));

	const toggleRadio = (key, value) => setDraft(current => {
		const available = radioOptions[key] ?? new Set();
		const selected = isRadioValueSelected(current.radioFilters[key], value);
		return { ...current, radioFilters: { ...current.radioFilters, [key]: updateRadioSelection(current.radioFilters[key], available, value, !selected) } };
	});

	const dayChips = field => (
		<ChipRow>
			{DAY_PRESETS.map(days => (
				<Chip
					key={days}
					label={days === 0 ? t('mobile:filters.anyTime') : t('mobile:filters.lastDays', { count: days })}
					selected={daysFromDate(draft[field]) === days}
					onPress={() => setDraft(current => ({ ...current, [field]: toDateString(days) }))}
				/>
			))}
		</ChipRow>
	);

	return (
		<Sheet
			visible={visible}
			title={t('filters:title')}
			onClose={onClose}
			footer={(
				<View style={styles.footer}>
					<Button style={styles.footerButton} variant="ghost" label={t('filters:clearFilters')} onPress={() => setDraft({ ...createDefaultFilters(), clusteringZoom: draft.clusteringZoom })} />
					<Button style={styles.footerButton} label={t('filters:apply')} onPress={() => onApply(draft)} />
				</View>
			)}
		>
			<Text style={styles.summary}>{t('filters:summary', { matching: matching.toLocaleString(), total: total.toLocaleString() })}</Text>

			<View style={styles.section}>
				<Label>{t('filters:nodeTypesLegend')}</Label>
				<ChipRow>
					{NODE_TYPES.map(type => (
						<Chip key={type} label={t(`map:nodeTypes.${NODE_TYPE_KEYS[type]}`)} color={typeColors[type]} selected={draft.nodeFilter.includes(type)} onPress={() => toggleType(type)} />
					))}
				</ChipRow>
			</View>

			<View style={styles.section}>
				<Label>{t('filters:lastUpdate')}</Label>
				{dayChips('fromDate')}
				<Label>{t('filters:added')}</Label>
				{dayChips('fromInsertDate')}
			</View>

			<Divider />
			<Label>{t('filters:radioTitle')}</Label>
			{RADIO_FILTER_KEYS.map(key => (
				<View key={key} style={styles.section}>
					<Label>{t(`filters:${RADIO_LABEL_KEYS[key]}`)}</Label>
					<ChipRow>
						{sortValues(radioOptions[key] ?? []).map(value => (
							<Chip key={value} label={value === 'unknown' ? t('filters:unknownFreq') : value} selected={isRadioValueSelected(draft.radioFilters[key], value)} onPress={() => toggleRadio(key, value)} />
						))}
					</ChipRow>
					{key === 'freq' && <Hint>{t('filters:unknownHint')}</Hint>}
				</View>
			))}

			<Divider />
			<View style={styles.section}>
				<Label>{t('filters:clusteringZoom')}</Label>
				<Stepper label={t('filters:clusteringZoom')} min={10} max={17} value={draft.clusteringZoom} onChange={clusteringZoom => setDraft(current => ({ ...current, clusteringZoom }))} />
			</View>
		</Sheet>
	);
};
