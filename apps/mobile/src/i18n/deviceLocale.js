// BCP 47 tag of the phone ("pl-PL"): language and region as set in the system, which is what the website negotiates from Accept-Language.
export const deviceLocale = () => Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
