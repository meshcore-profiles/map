import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from './src/i18n';
import { MapScreen } from './src/screens/MapScreen';
import { NodesProvider } from './src/state/NodesContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { ThemeProvider } from './src/state/ThemeContext';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { ToastProvider } from './src/ui/Toast';

export default function App() {
	return (
		<ErrorBoundary>
			<SafeAreaProvider>
				<SettingsProvider>
					<ThemeProvider>
						<I18nProvider>
							<ToastProvider>
								<NodesProvider>
									<MapScreen />
									<StatusBar style="light" />
								</NodesProvider>
							</ToastProvider>
						</I18nProvider>
					</ThemeProvider>
				</SettingsProvider>
			</SafeAreaProvider>
		</ErrorBoundary>
	);
}
