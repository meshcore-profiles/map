import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing } from '../theme';
import { Chevron } from './Chevron';
import { Touchable } from './Touchable';

const styles = StyleSheet.create({
	section: { gap: spacing.md },
	heading: { color: colors.textMuted, fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
	divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
	stat: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.md, gap: 2 },
	statLabel: { color: colors.textMuted, fontSize: 14 },
	statValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
	collapseHead: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
	collapseTitle: { flex: 1, color: colors.text, fontSize: 16 },
	collapseSummary: { color: colors.textMuted, fontSize: 14 },
	collapseBody: { gap: spacing.md, paddingBottom: spacing.md },
});

export const Divider = () => <View style={styles.divider} />;

export const Heading = ({ children }) => <Text style={styles.heading} accessibilityRole="header">{children}</Text>;

export const Section = ({ title, children }) => (
	<View style={styles.section}>
		{title && <Heading>{title}</Heading>}
		{children}
	</View>
);

// tone: 'good' | 'bad' colors the value.
export const Stat = ({ label, value, tone }) => (
	<View style={styles.stat}>
		<Text style={styles.statLabel}>{label}</Text>
		<Text style={[styles.statValue, tone === 'bad' && { color: colors.redBright }, tone === 'good' && { color: colors.green }]}>{value}</Text>
	</View>
);

export const Collapsible = ({ title, summary, children }) => {
	const [open, setOpen] = useState(false);

	return (
		<View>
			<Touchable style={styles.collapseHead} onPress={() => setOpen(current => !current)} accessibilityState={{ expanded: open }}>
				<Text style={styles.collapseTitle}>{title}</Text>
				<Text style={styles.collapseSummary}>{summary}</Text>
				<Chevron up={open} />
			</Touchable>
			{open && <View style={styles.collapseBody}>{children}</View>}
		</View>
	);
};
