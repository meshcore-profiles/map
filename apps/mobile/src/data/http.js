import Constants from 'expo-constants';

const REPOSITORY_URL = 'https://github.com/meshcore-profiles/map';

// Cloudflare in front of the API answers 403 to the default okhttp/CFNetwork user agent, so identify the app explicitly.
export const USER_AGENT = `MeshCoreMap/${Constants.expoConfig?.version ?? '0'} (+${REPOSITORY_URL})`;

export const apiHeaders = headers => ({ 'User-Agent': USER_AGENT, ...headers });

export const apiFetch = (url, init = {}) => fetch(url, { ...init, headers: apiHeaders(init.headers) });
