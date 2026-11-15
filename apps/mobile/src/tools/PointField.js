import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { spacing } from '../theme';
import { Button, Field } from '../ui/controls';

const styles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
	field: { flex: 1 },
	pick: { minWidth: 96 },
});

export const PointField = ({ label, value, placeholder, picking, pickLabel, onChangeText, onEndEditing, onTogglePick }) => {
	const { t } = useI18n();

	return (
		<View style={styles.row}>
			<View style={styles.field}>
				<Field label={label} value={value} onChangeText={onChangeText} onEndEditing={onEndEditing} placeholder={placeholder} />
			</View>
			<Button style={styles.pick} variant={picking ? 'primary' : 'secondary'} label={picking ? t('mobile:tools.picking') : pickLabel} onPress={onTogglePick} />
		</View>
	);
};
