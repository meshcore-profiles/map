import { Linking } from 'react-native';

// Opens a link in the system handler (browser, mail app); a failure (no app for it) is logged, since there is nothing useful to tell the user.
export const openLink = url => Linking.openURL(url).catch(err => console.warn('Link not opened:', err.message));
