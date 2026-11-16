import Bugsnag from '@bugsnag/expo';

let started = false;
let enabled = true;

// Starts error reporting once the server's key (from /api/v1/app-config) and the user's choice are known; without a key it stays off.
// Turning it off later keeps the notifier loaded but drops every report (and pauses the session) until it is turned on again.
export const syncBugsnag = (apiKey, allowed) => {
	enabled = allowed;

	if (!started) {
		if (!apiKey || !allowed) return;

		started = true;
		Bugsnag.start({ apiKey, onError: () => enabled });
		return;
	}

	if (allowed) Bugsnag.resumeSession();
	else Bugsnag.pauseSession();
};

export const notifyError = (error, onError) => {
	if (started && enabled) Bugsnag.notify(error, onError);
};
