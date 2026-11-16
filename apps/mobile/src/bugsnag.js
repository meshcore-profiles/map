import Bugsnag from '@bugsnag/expo';

let started = false;

// The key comes from /api/v1/app-config (the server's BUGSNAG_API_KEY); without it error reporting stays off.
export const startBugsnag = apiKey => {
	if (started || !apiKey) return;

	started = true;
	Bugsnag.start({ apiKey });
};

export const notifyError = (error, onError) => {
	if (started) Bugsnag.notify(error, onError);
};
