import { memo, useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../state/ThemeContext';
import { colors, radius, spacing } from '../theme';

const styles = StyleSheet.create({
	root: { position: 'absolute', left: spacing.sm, right: 72, alignItems: 'flex-start' },
	box: { backgroundColor: 'rgba(18, 21, 28, 0.72)', borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3 },
	text: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14 },
});

// The credits are the website's own strings (locale "map:tilesAttribution"): plain text with <a href> links and the &copy; entity.
const LINK = /<a href="([^"]+)">(.*?)<\/a>/g;

const parse = html => {
	const parts = [];
	let last = 0;

	for (const match of html.matchAll(LINK)) {
		if (match.index > last) parts.push({ text: html.slice(last, match.index) });
		parts.push({ text: match[2], url: match[1] });
		last = match.index + match[0].length;
	}
	if (last < html.length) parts.push({ text: html.slice(last) });

	return parts.map(part => ({ ...part, text: part.text.replaceAll('&copy;', '©') }));
};

// Always visible credits of the active basemap, as the website shows them (the licenses of the tile providers require them); the links open the providers' terms.
export const MapAttribution = memo(({ html }) => {
	const { accentBright } = useTheme();
	const insets = useSafeAreaInsets();
	const parts = useMemo(() => (html ? parse(html) : []), [html]);

	if (!parts.length) return null;

	return (
		<View style={[styles.root, { bottom: insets.bottom + spacing.sm }]} pointerEvents="box-none">
			<View style={styles.box} pointerEvents="box-none">
				<Text style={styles.text}>
					{parts.map((part, index) => (part.url
						? <Text key={index} style={{ color: accentBright }} onPress={() => Linking.openURL(part.url).catch(err => console.warn('Link not opened:', err.message))}>{part.text}</Text>
						: part.text))}
				</Text>
			</View>
		</View>
	);
});
