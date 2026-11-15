import { useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NODE_TYPE_COLORS, STATUS_COLORS } from '@meshcore-map/core/colors';
import { buildContactUrl } from '@meshcore-map/core/contact';
import { CONTACT_ADDABLE_TYPES, NODE_TYPE_KEYS, formatTimeAgo } from '@meshcore-map/core/nodes';
import { API_BASE } from '../config';
import { useI18n } from '../i18n';
import { Button, Divider } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { useTheme } from '../state/ThemeContext';
import { Sheet } from '../ui/Sheet';
import { colors, NODE_TYPE_ICONS, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
	dot: { width: 8, height: 8, borderRadius: 4 },
	badgeText: { color: colors.text, fontSize: 13 },
	row: { gap: 2 },
	rowLabel: { color: colors.textMuted, fontSize: 12 },
	rowValue: { color: colors.text, fontSize: 15 },
	mono: { fontFamily: 'monospace', fontSize: 13 },
	rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	copy: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
	copyText: { fontSize: 13, fontWeight: '600' },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
});

const RADIO_ORDER = ['freq', 'bw', 'sf', 'cr'];
const RADIO_UNITS = { freq: ' MHz', bw: ' kHz', sf: '', cr: '' };

const Row = ({ label, value, mono, copyLabel, copied, onCopy }) => {
	const { accentBright } = useTheme();

	return (
		<View style={styles.row}>
			<View style={styles.rowHead}>
				<Text style={styles.rowLabel}>{label}</Text>
				{onCopy && (
					<Pressable onPress={onCopy} hitSlop={8} accessibilityRole="button" accessibilityLabel={copyLabel}>
						<View style={styles.copy}>
							<Icon name={copied ? 'check' : 'copy'} size={15} color={accentBright} />
							<Text style={[styles.copyText, { color: accentBright }]}>{copyLabel}</Text>
						</View>
					</Pressable>
				)}
			</View>
			<Text style={[styles.rowValue, mono && styles.mono]} selectable>{value}</Text>
		</View>
	);
};

export const NodeSheet = ({ node, onClose }) => {
	const { t, tRaw, plural } = useI18n();
	const [copied, setCopied] = useState(null);
	if (!node) return null;

	const copy = async (id, value) => {
		await Clipboard.setStringAsync(value);
		setCopied(id);
	};
	const copyLabel = (id, label) => copied === id ? t('common:copiedToClipboard') : label;

	const ago = date => formatTimeAgo(date.getTime(), { t, tRaw, plural });
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
				<View style={styles.badge}>
					<Icon name={NODE_TYPE_ICONS[node.type]} size={16} color={NODE_TYPE_COLORS[node.type]} />
					<Text style={styles.badgeText}>{t(`map:nodeTypes.${NODE_TYPE_KEYS[node.type]}`)}</Text>
				</View>
				<View style={styles.badge}>
					<View style={[styles.dot, { backgroundColor: STATUS_COLORS[node.status] }]} />
					<Text style={styles.badgeText}>{t(`map:updateStatus.${node.status}`)}</Text>
				</View>
			</View>
			<Divider />
			<Row label={t('map:columns.publicKey')} value={node.public_key} mono copyLabel={copyLabel('key', t('map:copyPublicKey'))} copied={copied === 'key'} onCopy={() => copy('key', node.public_key)} />
			<Row label={t('map:columns.coords')} value={node.coords} copyLabel={copyLabel('coords', t('map:copyCoords'))} copied={copied === 'coords'} onCopy={() => copy('coords', node.coords)} />
			<Row label={t('map:columns.insertedDate')} value={dateLine(node.insertDate)} />
			{node.updatedDate && <Row label={t('map:columns.updatedDate')} value={dateLine(node.updatedDate)} />}
			<Row
				label={t('map:columns.params')}
				value={radioKeys.length ? radioKeys.map(key => `${t(`map:radioParams.${key}`)}: ${node.params[key]}${RADIO_UNITS[key]}`).join('\n') : t('map:noRadioData')}
			/>
			<View style={styles.actions}>
				<Button style={styles.action} variant="secondary" icon="link" label={t('common:share')} onPress={share} />
				{CONTACT_ADDABLE_TYPES.includes(node.type) && <Button style={styles.action} icon="plus" label={t('map:addContact')} onPress={addContact} />}
			</View>
		</Sheet>
	);
};
