import { Alert, Linking, Share, StyleSheet, Text, View } from 'react-native';
import { buildContactUrl } from '@meshcore-map/core/contact';
import { CONTACT_ADDABLE_TYPES, NODE_TYPE_KEYS, timeAgoParts } from '@meshcore-map/core/nodes';
import { API_BASE } from '../config';
import { useI18n } from '../i18n';
import { Button, Divider } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { colors, radius, spacing, statusColors } from '../theme';

const styles = StyleSheet.create({
	badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
	dot: { width: 8, height: 8, borderRadius: 4 },
	badgeText: { color: colors.text, fontSize: 13 },
	row: { gap: 2 },
	rowLabel: { color: colors.textMuted, fontSize: 12 },
	rowValue: { color: colors.text, fontSize: 15 },
	mono: { fontFamily: 'monospace', fontSize: 13 },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
});

const RADIO_ORDER = ['freq', 'bw', 'sf', 'cr'];
const RADIO_UNITS = { freq: ' MHz', bw: ' kHz', sf: '', cr: '' };

const Row = ({ label, value, mono }) => (
	<View style={styles.row} accessible>
		<Text style={styles.rowLabel}>{label}</Text>
		<Text style={[styles.rowValue, mono && styles.mono]} selectable>{value}</Text>
	</View>
);

export const NodeSheet = ({ node, onClose }) => {
	const { t, tRaw, plural } = useI18n();
	if (!node) return null;

	const ago = date => {
		const parts = timeAgoParts(date.getTime());
		if (!parts) return t('common:justNow');

		return t('common:timeAgo', { count: parts.count, unit: plural(parts.count, tRaw(`common:timeUnits.${parts.unit}`)) });
	};
	const dateLine = date => `${date.toLocaleString()} (${ago(date)})`;

	const radioKeys = RADIO_ORDER.filter(key => node.radio[key] !== 'unknown');

	const share = () => Share.share({ message: `${node.adv_name}\n${API_BASE}/?node=${node.public_key}` });

	const addContact = async () => {
		try {
			await Linking.openURL(buildContactUrl(node));
		} catch {
			Alert.alert(t('map:addContactErrorTitle'), t('map:addContactErrorText'));
		}
	};

	return (
		<Sheet visible title={node.adv_name} onClose={onClose}>
			<View style={styles.badges}>
				<View style={styles.badge}><Text style={styles.badgeText}>{t(`map:nodeTypes.${NODE_TYPE_KEYS[node.type]}`)}</Text></View>
				<View style={styles.badge}>
					<View style={[styles.dot, { backgroundColor: statusColors[node.status] }]} />
					<Text style={styles.badgeText}>{t(`map:updateStatus.${node.status}`)}</Text>
				</View>
			</View>
			<Divider />
			<Row label={t('map:columns.publicKey')} value={node.public_key} mono />
			<Row label={t('map:columns.coords')} value={node.coords} />
			<Row label={t('map:columns.insertedDate')} value={dateLine(node.insertDate)} />
			{node.updatedDate && <Row label={t('map:columns.updatedDate')} value={dateLine(node.updatedDate)} />}
			<Row
				label={t('map:columns.params')}
				value={radioKeys.length ? radioKeys.map(key => `${t(`map:radioParams.${key}`)}: ${node.params[key]}${RADIO_UNITS[key]}`).join('\n') : t('map:noRadioData')}
			/>
			<View style={styles.actions}>
				<Button style={styles.action} variant="secondary" label={t('common:share')} onPress={share} />
				{CONTACT_ADDABLE_TYPES.includes(node.type) && <Button style={styles.action} label={t('map:addContact')} onPress={addContact} />}
			</View>
		</Sheet>
	);
};
