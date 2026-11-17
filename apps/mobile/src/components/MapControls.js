import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SITES } from '@meshcore-map/core/sites';
import { useI18n } from '../i18n';
import { spacing } from '../theme';
import { Fab, FAB_SIZE } from '../ui/Fab';
import { StatusBanner } from './StatusBanner';

const styles = StyleSheet.create({
	fabStack: { position: 'absolute', right: spacing.md, alignItems: 'center', gap: spacing.sm },
	status: { position: 'absolute', left: spacing.md },
});

const TOOL_FABS = [
	{ id: 'terrain', icon: 'terrain', title: 'terrain:toggleTitle' },
	{ id: 'coverage', icon: 'coverage', title: 'coverage:toggleTitle' },
	{ id: 'route', icon: 'route', title: 'route:toggleTitle' },
	{ id: 'measure', icon: 'ruler', title: 'measure:toggleTitle' },
];

export const MapControls = ({ region, features, showAddButton, toolsOpen, onToggleTools, onOpenTool, onOpenBasemap, onOpenLegend }) => {
	const { t } = useI18n();
	const insets = useSafeAreaInsets();
	const bottom = insets.bottom + spacing.md;

	return (
		<>
			<View style={[styles.fabStack, { bottom }]}>
				{toolsOpen && TOOL_FABS.filter(tool => features?.[tool.id] !== false).map(tool => (
					<Fab key={tool.id} icon={tool.icon} label={t(tool.title)} onPress={() => onOpenTool(tool.id)} />
				))}
				<Fab icon={toolsOpen ? 'close' : 'wrench'} label={t('settings:tabTools')} onPress={onToggleTools} />
				<Fab icon="info" label={t('legend:toggleTitle')} onPress={onOpenLegend} />
				<Fab icon="layers" label={t('map:basemapToggleTitle')} onPress={onOpenBasemap} />
				{showAddButton && <Fab primary icon="plus" label={t('map:addNodeTitle')} onPress={() => Linking.openURL(SITES[region].addNodeUrl)} />}
			</View>
			<View style={[styles.status, { bottom, right: spacing.md * 2 + FAB_SIZE }]}>
				<StatusBanner />
			</View>
		</>
	);
};
