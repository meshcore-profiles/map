import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { NODE_TYPE_COLORS, STATUS_COLORS } from '@meshcore-map/core/colors';
import { buildContactUrl } from '@meshcore-map/core/contact';
import { CONTACT_ADDABLE_TYPES, NODE_TYPE_KEYS, formatTimeAgo } from '@meshcore-map/core/nodes';
import { truncateKey } from '@meshcore-map/core/node-utils';
import { API_BASE } from '../config';
import { useI18n } from '../i18n';
import { useTheme } from '../state/ThemeContext';
import { colors, NODE_TYPE_ICONS, radius, spacing } from '../theme';
import { Button } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { DockedSheet } from '../ui/Sheet';

const styles = StyleSheet.create({
	meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
	metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	metaText: { color: colors.textMuted, fontSize: 14 },
	dot: { width: 8, height: 8, borderRadius: 4 },
	separator: { color: colors.borderStrong, fontSize: 14 },
	fresh: { gap: 2 },
	freshMain: { color: colors.text, fontSize: 17, fontWeight: '600' },
	freshSub: { color: colors.textMuted, fontSize: 13 },
	radio: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
	radioChip: { backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
	radioText: { color: colors.text, fontSize: 13, fontVariant: ['tabular-nums'] },
	key: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bg, borderRadius: radius.sm, paddingLeft: spacing.md, minHeight: 44 },
	keyText: { flex: 1, color: colors.text, fontFamily: 'monospace', fontSize: 13 },
	copy: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
	actions: { flexDirection: 'row', gap: spacing.sm },
	action: { flex: 1 },
});

// Radio parameters as short chips: frequency and bandwidth carry a unit, spreading factor and coding rate are labelled with their usual abbreviations.
const RADIO_FORMATS = {
	freq: value => `${value} MHz`,
	bw: value => `${value} kHz`,
	sf: value => `SF${value}`,
	cr: value => `CR ${value}`,
};

const Meta = ({ node }) => {
	const { t } = useI18n();

	return (
		<View style={styles.meta}>
			<View style={styles.metaItem}>
				<Icon name={NODE_TYPE_ICONS[node.type]} size={16} color={NODE_TYPE_COLORS[node.type]} />
				<Text style={styles.metaText}>{t(`map:nodeTypes.${NODE_TYPE_KEYS[node.type]}`)}</Text>
			</View>
			<Text style={styles.separator}>/</Text>
			<View style={styles.metaItem}>
				<View style={[styles.dot, { backgroundColor: STATUS_COLORS[node.status] }]} />
				<Text style={styles.metaText}>{t(`map:updateStatus.${node.status}`)}</Text>
			</View>
		</View>
	);
};

// How fresh the node's data is: the update time when the node reports one, otherwise when it was added.
const Freshness = ({ node }) => {
	const { t, tRaw, plural } = useI18n();
	const date = node.updatedDate || node.insertDate;
	const label = node.updatedDate ? t('map:columns.updatedDate') : t('map:columns.insertedDate');

	return (
		<View style={styles.fresh}>
			<Text style={styles.freshMain}>{`${label} ${formatTimeAgo(date.getTime(), { t, tRaw, plural })}`}</Text>
			<Text style={styles.freshSub}>{date.toLocaleString()}</Text>
		</View>
	);
};

const NodePanel = ({ node, visible, onClose, onExited }) => {
	const { t } = useI18n();
	const { accentBright } = useTheme();
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		setCopied(false);
	}, [node.public_key]);

	const radio = Object.keys(RADIO_FORMATS).filter(key => node.radio[key] !== 'unknown');

	const copyKey = async () => {
		await Clipboard.setStringAsync(node.public_key);
		setCopied(true);
	};

	const share = () => Share.share({ message: `${node.adv_name}\n${API_BASE}/?node=${node.public_key}` });

	const addContact = async () => {
		try {
			await Linking.openURL(buildContactUrl(node));
		} catch {
			Alert.alert(t('map:addContactErrorTitle'), t('map:addContactErrorText'));
		}
	};

	return (
		<DockedSheet
			title={node.adv_name}
			visible={visible}
			onClose={onClose}
			onExited={onExited}
			footer={(
				<View style={styles.actions}>
					<Button style={styles.action} variant="secondary" icon="link" label={t('common:share')} onPress={share} />
					{CONTACT_ADDABLE_TYPES.includes(node.type) && <Button style={styles.action} icon="plus" label={t('map:addContact')} onPress={addContact} />}
				</View>
			)}
		>
			<Meta node={node} />
			<Freshness node={node} />
			{radio.length > 0 && (
				<View style={styles.radio}>
					{radio.map(key => (
						<View key={key} style={styles.radioChip} accessible accessibilityLabel={`${t(`map:radioParams.${key}`)}: ${node.params[key]}`}>
							<Text style={styles.radioText}>{RADIO_FORMATS[key](node.params[key])}</Text>
						</View>
					))}
				</View>
			)}
			<Pressable style={styles.key} onPress={copyKey} accessibilityRole="button" accessibilityLabel={t('map:copyPublicKey')}>
				<Text style={styles.keyText} numberOfLines={1}>{truncateKey(node.public_key, 12)}</Text>
				<View style={styles.copy}>
					<Icon name={copied ? 'check' : 'copy'} size={18} color={copied ? colors.green : accentBright} />
				</View>
			</Pressable>
		</DockedSheet>
	);
};

// Stays mounted for the slide-out animation after the parent clears `node`.
export const NodeSheet = ({ node, onClose }) => {
	const [lastNode, setLastNode] = useState(node);

	useEffect(() => {
		if (node) setLastNode(node);
	}, [node]);

	const display = node ?? lastNode;
	if (!display) return null;

	return <NodePanel node={display} visible={Boolean(node)} onClose={onClose} onExited={() => setLastNode(null)} />;
};
