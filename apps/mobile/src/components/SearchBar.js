import { useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NODE_TYPE_COLORS } from '@meshcore-map/core/colors';
import { searchNodes } from '@meshcore-map/core/nodes';
import { truncateKey } from '@meshcore-map/core/node-utils';
import { useI18n } from '../i18n';
import { Icon } from '../ui/Icon';
import { colors, MIN_TOUCH, NODE_TYPE_ICONS, radius, shadow, spacing } from '../theme';

const styles = StyleSheet.create({
	root: { flex: 1 },
	bar: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingLeft: spacing.md, paddingRight: spacing.xs, ...shadow },
	input: { flex: 1, minHeight: MIN_TOUCH, color: colors.text, fontSize: 15, paddingHorizontal: spacing.sm },
	clear: { padding: spacing.xs },
	actions: { flexDirection: 'row', alignItems: 'center' },
	results: { marginTop: spacing.xs, maxHeight: 280, backgroundColor: colors.panelSolid, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xs, ...shadow },
	item: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
	itemText: { flex: 1 },
	name: { color: colors.text, fontSize: 15 },
	key: { color: colors.textMuted, fontSize: 12, fontFamily: 'monospace' },
	empty: { color: colors.textMuted, padding: spacing.lg },
});

export const SearchBar = ({ nodes, onSelect, children }) => {
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
			<View style={styles.bar}>
				<Icon name="search" size={20} color={colors.textMuted} />
				<TextInput
					style={styles.input}
					value={query}
					onChangeText={setQuery}
					placeholder={t('map:searchPlaceholder')}
					placeholderTextColor={colors.textMuted}
					autoCorrect={false}
					autoCapitalize="none"
					returnKeyType="search"
					accessibilityLabel={t('map:searchPlaceholder')}
				/>
				{query.length > 0 && (
					<Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clear} accessibilityRole="button" accessibilityLabel={t('common:clear')}>
						<Icon name="close" size={18} color={colors.textMuted} />
					</Pressable>
				)}
				<View style={styles.actions}>{children}</View>
			</View>
			{query.trim().length > 0 && (
				<FlatList
					style={styles.results}
					data={results}
					keyExtractor={node => node.public_key}
					keyboardShouldPersistTaps="handled"
					ListEmptyComponent={<Text style={styles.empty}>{t('mobile:search.noResults')}</Text>}
					renderItem={({ item }) => (
						<Pressable style={styles.item} onPress={() => select(item)} accessibilityRole="button">
							<Icon name={NODE_TYPE_ICONS[item.type]} size={22} color={NODE_TYPE_COLORS[item.type]} />
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
