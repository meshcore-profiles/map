import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from './src/i18n';
import { MapScreen } from './src/screens/MapScreen';
import { NodesProvider } from './src/state/NodesContext';
import { SettingsProvider } from './src/state/SettingsContext';

export default function App() {
	return (
		<SettingsProvider>
			<I18nProvider>
				<NodesProvider>
					<MapScreen />
					<StatusBar style="light" />
				</NodesProvider>
			</I18nProvider>
		</SettingsProvider>
	);
}
