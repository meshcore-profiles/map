import Bugsnag from '@bugsnag/expo';

// Only the exception, the app version and the OS/runtime are sent: no sessions, breadcrumbs (console, network URLs), user id or device id.
// The device block is cut down to a whitelist, everything else the notifier collects is dropped.
const DEVICE_FIELDS = ['osName', 'osVersion', 'runtimeVersions', 'manufacturer', 'model'];
const APP_FIELDS = ['version', 'releaseStage', 'type'];

let started = false;
let enabled = true;

const pick = (source, fields) => Object.fromEntries(fields.filter(key => source?.[key] !== undefined).map(key => [key, source[key]]));

const scrub = event => {
	if (!enabled) return false;

	event.device = pick(event.device, DEVICE_FIELDS);
	event.app = pick(event.app, APP_FIELDS);
	event.setUser(undefined, undefined, undefined);
	event.clearMetadata('device');
	event.breadcrumbs = [];
	return true;
};

// Starts error reporting once the server's key (from /api/v1/app-config) and the user's choice are known; without a key it stays off.
// Turning it off later keeps the notifier loaded but drops every report until it is turned on again. Only production builds report.
export const syncBugsnag = (apiKey, allowed) => {
	enabled = allowed;
	if (started || !apiKey || !allowed) return;

	started = true;
	Bugsnag.start({
		apiKey,
		autoTrackSessions: false,
		enabledBreadcrumbTypes: [],
		enabledReleaseStages: ['production'],
		onError: scrub,
	});
};

export const notifyError = (error, onError) => {
	if (started && enabled) Bugsnag.notify(error, onError);
};
