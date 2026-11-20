import { t } from './i18n.js';
import * as ntools from './node-utils.js';

export const initRegionWarning = ({ apiUrl }) => {
	const overlay = document.getElementById('region-warning-overlay');
	const confirmBtn = document.getElementById('region-warning-confirm');
	const cancelBtn = document.getElementById('region-warning-cancel');
	const sizeEl = document.getElementById('region-warning-size');

	const fetchSize = async region => {
		try {
			const res = await fetch(apiUrl(region), { method: 'HEAD' });
			return Number(res.headers.get('Content-Length')) || 0;
		} catch {
			return 0;
		}
	};

	const ask = () => new Promise(resolve => {
		function cleanup(confirmed) {
			overlay.hidden = true;
			confirmBtn.removeEventListener('click', onConfirm);
			cancelBtn.removeEventListener('click', onCancel);
			overlay.removeEventListener('click', onOverlayClick);
			document.removeEventListener('keydown', onKeydown);
			resolve(confirmed);
		}

		function onConfirm() { cleanup(true); }
		function onCancel() { cleanup(false); }
		function onOverlayClick(e) { if (e.target === overlay) cleanup(false); }
		function onKeydown(e) { if (e.key === 'Escape') cleanup(false); }

		confirmBtn.addEventListener('click', onConfirm);
		cancelBtn.addEventListener('click', onCancel);
		overlay.addEventListener('click', onOverlayClick);
		document.addEventListener('keydown', onKeydown);

		overlay.hidden = false;
		cancelBtn.focus();
	});

	return {
		async confirm(region) {
			const size = await fetchSize(region);
			sizeEl.textContent = size ? t('map:aboutSize', { size: ntools.formatBytes(size) }) : t('map:unknownSize');

			return ask();
		},
	};
};
