import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Cloudflare in front of the API answers 403 to the default okhttp/CFNetwork user agent, so identify the app explicitly.
export const USER_AGENT = `MeshCoreMap/${Constants.expoConfig?.version ?? '0'} (${Platform.OS})`;

export const apiHeaders = headers => ({ 'User-Agent': USER_AGENT, ...headers });

export const apiFetch = (url, init = {}) => fetch(url, { ...init, headers: apiHeaders(init.headers) });
