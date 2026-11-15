import { useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchNodes } from '@meshcore-map/core/nodes';
import { truncateKey } from '@meshcore-map/core/node-utils';
import { useI18n } from '../i18n';
import { colors, MIN_TOUCH, radius, spacing, typeColors } from '../theme';

const styles = StyleSheet.create({
	root: { flex: 1 },
	input: { minHeight: MIN_TOUCH, backgroundColor: colors.panel, color: colors.text, borderRadius: radius.md, paddingHorizontal: spacing.lg, elevation: 4 },
	results: { marginTop: spacing.xs, maxHeight: 280, backgroundColor: colors.panel, borderRadius: radius.md, elevation: 4 },
	item: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
	dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
	itemText: { flex: 1 },
	name: { color: colors.text, fontSize: 15 },
	key: { color: colors.textMuted, fontSize: 12 },
	empty: { color: colors.textMuted, padding: spacing.lg },
});

export const SearchBar = ({ nodes, onSelect }) => {
	const { t } = useI18n();
	const [query, setQuery] = useState('');
	const results = useMemo(() => searchNodes(nodes, query.trim()), [nodes, query]);

	const select = node => {
		Keyboard.dismiss();
		setQuery('');
		onSelect(node);
	};

	return (
		<View style={styles.root}>
			<TextInput
				style={styles.input}
				value={query}
				onChangeText={setQuery}
				placeholder={t('map:searchPlaceholder')}
				placeholderTextColor={colors.textMuted}
				autoCorrect={false}
				autoCapitalize="none"
				returnKeyType="search"
				clearButtonMode="while-editing"
				accessibilityLabel={t('map:searchPlaceholder')}
			/>
			{query.trim().length > 0 && (
				<FlatList
					style={styles.results}
					data={results}
					keyExtractor={node => node.public_key}
					keyboardShouldPersistTaps="handled"
					ListEmptyComponent={<Text style={styles.empty}>{t('mobile:search.noResults')}</Text>}
					renderItem={({ item }) => (
						<Pressable style={styles.item} onPress={() => select(item)} accessibilityRole="button">
							<View style={[styles.dot, { borderColor: typeColors[item.type] }]} />
							<View style={styles.itemText}>
								<Text style={styles.name} numberOfLines={1}>{item.adv_name}</Text>
								<Text style={styles.key}>{truncateKey(item.public_key)}</Text>
							</View>
						</Pressable>
					)}
				/>
			)}
		</View>
	);
};
