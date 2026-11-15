import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NODE_TYPE_COLORS } from '@meshcore-map/core/colors';
import { buildFilterParams } from '@meshcore-map/core/filter-share';
import { collectFilteredNodes, createDefaultFilters, NODE_TYPES, NODE_TYPE_KEYS } from '@meshcore-map/core/nodes';
import { isRadioValueSelected, RADIO_FILTER_KEYS, updateRadioSelection } from '@meshcore-map/core/radio-filter-utils';
import { API_BASE } from '../config';
import { useI18n } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import { colors, NODE_TYPE_ICONS, spacing } from '../theme';
import { Button, Chip, ChipRow, Divider, Field, Hint, Label, Stepper } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

const styles = StyleSheet.create({
	summary: { color: colors.textMuted },
	footer: { flexDirection: 'row', gap: spacing.sm },
	footerButton: { flex: 1 },
	section: { gap: spacing.sm },
	groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	groupTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
	count: { color: colors.textMuted, fontSize: 13 },
	bulk: { flexDirection: 'row', gap: spacing.md },
	bulkText: { fontSize: 14, fontWeight: '600', paddingVertical: spacing.xs },
});

const RADIO_LABEL_KEYS = { freq: 'frequency', sf: 'sf', cr: 'cr', bw: 'bw' };
const DAY_PRESETS = [0, 1, 7, 30, 90];
const DAY_MS = 86400000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateString = days => (days ? new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10) : '');

const sortValues = values => [...values].sort((a, b) => a === 'unknown' ? 1 : b === 'unknown' ? -1 : Number(a) - Number(b));

// "Last N days" presets and an exact date (YYYY-MM-DD), like the website's date input.
const DateFilter = ({ label, value, onChange }) => {
	const { t } = useI18n();
	const [text, setText] = useState(value);

	useEffect(() => setText(value), [value]);

	const edit = next => {
		setText(next);
		if (next === '') onChange('');
		else if (DATE_PATTERN.test(next) && !Number.isNaN(Date.parse(next))) onChange(next);
	};

	return (
		<View style={styles.section}>
			<Label>{label}</Label>
			<ChipRow>
				{DAY_PRESETS.map(days => (
					<Chip
						key={days}
						label={days === 0 ? t('mobile:filters.anyTime') : days === 1 ? t('mobile:filters.lastDay') : t('mobile:filters.lastDays', { count: days })}
						selected={value === toDateString(days)}
						onPress={() => onChange(toDateString(days))}
					/>
				))}
			</ChipRow>
			<Field value={text} onChangeText={edit} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} accessibilityLabel={label} />
		</View>
	);
};

// One radio parameter (frequency, SF, CR, BW): value chips with a counter and All / None shortcuts.
// `values` are all options (the counter), `shown` the ones left after a search.
const RadioGroup = ({ title, values, shown, selection, search, hint, onToggle, onSelectAll, onSelectNone }) => {
	const { t } = useI18n();
	const { accentBright } = useTheme();
	const selected = values.filter(value => isRadioValueSelected(selection, value)).length;

	return (
		<View style={styles.section}>
			<View style={styles.groupHead}>
				<View style={styles.groupTitle}>
					<Label>{title}</Label>
					<Text style={styles.count}>{`${selected}/${values.length}`}</Text>
				</View>
				<View style={styles.bulk}>
					<Pressable onPress={onSelectAll} disabled={selected === values.length} hitSlop={6} accessibilityRole="button">
						<Text style={[styles.bulkText, { color: accentBright, opacity: selected === values.length ? 0.4 : 1 }]}>{t('filters:selectAll')}</Text>
					</Pressable>
					<Pressable onPress={onSelectNone} disabled={selected === 0} hitSlop={6} accessibilityRole="button">
						<Text style={[styles.bulkText, { color: accentBright, opacity: selected === 0 ? 0.4 : 1 }]}>{t('filters:selectNone')}</Text>
					</Pressable>
				</View>
			</View>
			{search}
			{shown.length === 0 && values.length > 0 ? <Hint>{t('filters:noFrequencies')}</Hint> : (
				<ChipRow>
					{shown.map(value => (
						<Chip key={value} label={value === 'unknown' ? t('filters:unknownFreq') : value} selected={isRadioValueSelected(selection, value)} onPress={() => onToggle(value)} />
					))}
				</ChipRow>
			)}
			{hint}
		</View>
	);
};

// Filters are edited on a draft copy; the match count updates live and settings change only on "Apply".
export const FiltersSheet = ({ visible, filters, byType, radioOptions, total, onApply, onClose }) => {
	const { t } = useI18n();
	const showToast = useToast();
	const { settings } = useSettings();
	const [draft, setDraft] = useState(filters);
	const [freqQuery, setFreqQuery] = useState('');

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

	const setRadio = (key, selection) => setDraft(current => ({ ...current, radioFilters: { ...current.radioFilters, [key]: selection } }));

	const copyLink = async () => {
		const params = buildFilterParams({ ...draft, region: settings.region }, { includeRegion: true });
		await Clipboard.setStringAsync(`${API_BASE}/?${params}`);
		showToast(t('filters:linkCopied'));
	};

	const searchFrequencies = values => {
		const query = freqQuery.trim();
		return query ? values.filter(value => value.includes(query)) : values;
	};

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
			<Button variant="secondary" icon="link" label={t('filters:shareTitle')} onPress={copyLink} />

			<View style={styles.section}>
				<Label>{t('filters:nodeTypesLegend')}</Label>
				<ChipRow>
					{NODE_TYPES.map(type => (
						<Chip key={type} icon={NODE_TYPE_ICONS[type]} label={t(`map:nodeTypes.${NODE_TYPE_KEYS[type]}`)} color={NODE_TYPE_COLORS[type]} selected={draft.nodeFilter.includes(type)} onPress={() => toggleType(type)} />
					))}
				</ChipRow>
			</View>

			<Divider />
			<Label>{t('filters:radioTitle')}</Label>
			{RADIO_FILTER_KEYS.map(key => {
				const values = sortValues(radioOptions[key] ?? []);
				const isFreq = key === 'freq';

				return (
					<RadioGroup
						key={key}
						title={t(`filters:${RADIO_LABEL_KEYS[key]}`)}
						values={values}
						shown={isFreq ? searchFrequencies(values) : values}
						selection={draft.radioFilters[key]}
						search={isFreq ? <Field value={freqQuery} onChangeText={setFreqQuery} placeholder={t('filters:searchFrequency')} keyboardType="numeric" accessibilityLabel={t('filters:searchFrequency')} /> : null}
						hint={isFreq ? <Hint>{t('filters:unknownHint')}</Hint> : null}
						onToggle={value => toggleRadio(key, value)}
						onSelectAll={() => setRadio(key, null)}
						onSelectNone={() => setRadio(key, [])}
					/>
				);
			})}

			<Divider />
			<Label>{t('filters:datesTitle')}</Label>
			<DateFilter label={t('filters:lastUpdate')} value={draft.fromDate} onChange={fromDate => setDraft(current => ({ ...current, fromDate }))} />
			<DateFilter label={t('filters:added')} value={draft.fromInsertDate} onChange={fromInsertDate => setDraft(current => ({ ...current, fromInsertDate }))} />

			<Divider />
			<View style={styles.section}>
				<Label>{t('filters:clusteringZoom')}</Label>
				<Stepper label={t('filters:clusteringZoom')} min={10} max={17} value={draft.clusteringZoom} onChange={clusteringZoom => setDraft(current => ({ ...current, clusteringZoom }))} />
			</View>
		</Sheet>
	);
};
