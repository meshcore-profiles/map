import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { MapScreen } from './src/screens/MapScreen';
import { NodesProvider } from './src/state/NodesContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { ErrorBoundary } from './src/ui/ErrorBoundary';

export default function App() {
	return (
		<ErrorBoundary>
			<SafeAreaProvider>
				<SettingsProvider>
					<I18nProvider>
						<NodesProvider>
							<MapScreen />
							<StatusBar style="light" />
						</NodesProvider>
					</I18nProvider>
				</SettingsProvider>
			</SafeAreaProvider>
		</ErrorBoundary>
	);
}
