import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Approximate safe-area insets without an extra dependency. Meant to be replaced by react-native-safe-area-context.
const TOP = Constants.statusBarHeight || (Platform.OS === 'ios' ? 47 : 24);
const BOTTOM = Platform.OS === 'ios' ? 24 : 16;

export const useInsets = () => ({ top: TOP, bottom: BOTTOM });
