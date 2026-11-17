import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { buildDeletionMailUrl } from '@meshcore-map/core/deletion';
import { API_BASE } from '../config';
import { useI18n } from '../i18n';
import { colors, radius, spacing } from '../theme';
import { Dialog, DialogText } from '../ui/Dialog';

const styles = StyleSheet.create({
	identity: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md, gap: 4 },
	name: { color: colors.text, fontSize: 16, fontWeight: '600' },
	key: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 12 },
	error: { color: colors.redBright, fontSize: 14 },
});

const SITE_HOST = new URL(API_BASE).host;

const STEP_TEXT = { question: 'map:deletion.ownerQuestion', ready: 'map:deletion.ready', ownerOnly: 'map:deletion.ownerOnly' };

// The website's deletion dialog without the captcha (which only guards the server call): ask about ownership, then hand over the prepared e-mail.
// Steps: question -> ready | ownerOnly.
export const NodeDeletionDialog = ({ node, visible, onClose }) => {
	const { t } = useI18n();
	const [step, setStep] = useState('question');
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (visible) {
			setStep('question');
			setFailed(false);
		}
	}, [visible, node?.public_key]);

	const openMail = async () => {
		try {
			await Linking.openURL(buildDeletionMailUrl(node.public_key, key => t(key), SITE_HOST));
			setFailed(false);
		} catch {
			setFailed(true);
		}
	};

	const close = { label: t('common:close'), onPress: onClose };
	const actions = {
		question: [{ label: t('map:deletion.no'), onPress: () => setStep('ownerOnly') }, { label: t('mobile:deletion.yes'), variant: 'danger', onPress: () => setStep('ready') }],
		ready: [close, { label: t('map:deletion.openEmail'), variant: 'danger', onPress: openMail }],
		ownerOnly: [close],
	}[step];

	return (
		<Dialog visible={visible && Boolean(node)} title={t('map:reportDeletion')} onClose={onClose} actions={actions}>
			{node && (
				<View style={styles.identity}>
					<Text style={styles.name} numberOfLines={2}>{node.adv_name}</Text>
					<Text style={styles.key} selectable>{node.public_key}</Text>
				</View>
			)}
			<DialogText>{t(STEP_TEXT[step])}</DialogText>
			{failed && <Text style={styles.error}>{t('map:deletion.errors.request')}</Text>}
		</Dialog>
	);
};
