// Tools that can be switched off without a deploy of the frontend (exposed as window.MAP_CONFIG.features).
module.exports = {
	terrain: true,
	coverage: true,
	// "Open in the app" banner for shared links on Android; keep off until the app is published.
	appBanner: false,
};
