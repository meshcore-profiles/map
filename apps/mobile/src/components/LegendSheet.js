import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { NODE_TYPE_COLORS, STATUS_COLORS } from '@meshcore-map/core/colors';
import { NODE_STATUSES, NODE_TYPE_KEYS, NODE_TYPES } from '@meshcore-map/core/nodes';
import { useI18n } from '../i18n';
import { useNodes } from '../state/NodesContext';
import { colors, NODE_TYPE_ICONS, spacing } from '../theme';
import { Button, Divider, Heading } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

const styles = StyleSheet.create({
	group: { gap: spacing.sm },
	row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
	dot: { width: 14, height: 14, borderRadius: 7, marginHorizontal: 3 },
	text: { color: colors.text, fontSize: 15, flex: 1 },
	meta: { color: colors.textMuted, fontSize: 13 },
	entry: { gap: spacing.xs },
	entryTitle: { flexDirection: 'row', justifyContent: 'space-between' },
	version: { color: colors.text, fontWeight: '700' },
	change: { color: colors.text, fontSize: 14, lineHeight: 20 },
});

// Marker legend (node types and update statuses) like the website's, with the changelog behind a button.
export const LegendSheet = ({ visible, onClose }) => {
	const { t, tRaw } = useI18n();
	const { fetchedAt } = useNodes();
	const [changelog, setChangelog] = useState(false);

	const close = () => {
		setChangelog(false);
		onClose();
	};

	return (
		<Sheet visible={visible} title={changelog ? t('legend:changelogButton') : t('legend:toggleTitle')} onClose={close}>
			{changelog ? (
				<>
					{(tRaw('appChangelog:entries') ?? []).map(entry => (
						<View key={entry.version} style={styles.entry}>
							<View style={styles.entryTitle}>
								<Text style={styles.version}>{`v${entry.version}`}</Text>
								<Text style={styles.meta}>{entry.date}</Text>
							</View>
							{entry.changes.map(change => <Text key={change} style={styles.change}>{`- ${change.replace(/<[^>]+>/g, '')}`}</Text>)}
						</View>
					))}
					<Button variant="secondary" label={t('close')} onPress={() => setChangelog(false)} />
				</>
			) : (
				<>
					<View style={styles.group}>
						<Heading>{t('legend:typeTitle')}</Heading>
						{NODE_TYPES.map(type => (
							<View key={type} style={styles.row}>
								<Icon name={NODE_TYPE_ICONS[type]} size={22} color={NODE_TYPE_COLORS[type]} />
								<Text style={styles.text}>{t(`map:nodeTypes.${NODE_TYPE_KEYS[type]}`)}</Text>
							</View>
						))}
					</View>
					<Divider />
					<View style={styles.group}>
						<Heading>{t('legend:mapTitle')}</Heading>
						{NODE_STATUSES.map(status => (
							<View key={status} style={styles.row}>
								<View style={[styles.dot, { backgroundColor: STATUS_COLORS[status] }]} />
								<Text style={styles.text}>{t(`map:updateStatus.${status}`)}</Text>
							</View>
						))}
					</View>
					<Divider />
					<Text style={styles.meta}>{t('mobile:settings.version', { version: Constants.expoConfig?.version ?? '' })}</Text>
					<Text style={styles.meta}>{`${t('legend:dataUpdate')}${fetchedAt ? new Date(fetchedAt).toLocaleString() : '-'}`}</Text>
					<Button variant="secondary" label={t('legend:changelogButton')} onPress={() => setChangelog(true)} />
				</>
			)}
		</Sheet>
	);
};
