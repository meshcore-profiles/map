export const PROFILES_URL = (process.env.PROFILES_URL || 'https://meshcoreprofiles.com').replace(/\/+$/, '');
export const PROFILES_ORIGIN = new URL(PROFILES_URL).origin;
export const FLASHER_ORIGIN = (process.env.FLASHER_ORIGIN || 'https://flasher.meshcore.io').replace(/\/+$/, '');
