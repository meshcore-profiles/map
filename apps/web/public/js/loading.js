import * as ntools from './node-utils.js';

const PHASES = {
	connect: { from: 0, to: 5 },
	download: { from: 5, to: 55 },
	unpack: { from: 55, to: 60 },
	process: { from: 60, to: 90 },
	presets: { from: 90, to: 100 },
};

const formatSize = (receivedBytes, totalBytes) => (totalBytes ? `${ntools.formatBytes(receivedBytes)} / ${ntools.formatBytes(totalBytes)}` : ntools.formatBytes(receivedBytes));

export const initLoadingOverlay = () => {
	const overlay = document.getElementById('loading-overlay');
	const status = document.getElementById('loading-status');
	const progressBar = document.getElementById('loading-progress-bar');
	const meta = document.getElementById('loading-meta');
	const cancelBtn = document.getElementById('loading-cancel-btn');

	return {
		setLoading(loading) {
			overlay.hidden = !loading;
			if (!loading) return;

			status.textContent = '';
			progressBar.style.width = '0%';
			meta.textContent = '';
		},

		setStatus(text) {
			status.textContent = text;
		},

		setProgress(phase, fraction = 1) {
			const { from, to } = PHASES[phase];
			const pct = from + (to - from) * Math.min(1, Math.max(0, fraction));
			progressBar.style.width = `${pct}%`;
		},

		showDownload(receivedBytes, totalBytes, elapsedSec) {
			const speed = elapsedSec > 0 ? receivedBytes / elapsedSec : 0;
			meta.textContent = `${formatSize(receivedBytes, totalBytes)} · ${ntools.formatBytes(speed)}/s`;
		},

		showDownloadDone(receivedBytes, totalBytes, doneText) {
			meta.textContent = `${formatSize(receivedBytes, totalBytes)} · ${doneText}`;
		},

		onCancel(handler) {
			cancelBtn.addEventListener('click', handler);
		},
	};
};
