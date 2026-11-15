import { tRaw } from './i18n.js';
import { initModal } from './modal.js';

export const initChangelogModal = ({ onDismiss }) => {
	const modal = initModal('changelog-toggle', 'changelog-overlay', { onDismiss });
	const listEl = document.getElementById('changelog-list');

	listEl.innerHTML = tRaw('changelog:entries').map(entry => `
		<li class="changelog-version">
			<div class="changelog-version-title">
				<span>v${entry.version}</span>
				<time class="changelog-version-date">${entry.date}</time>
			</div>
			<ul class="changelog-changes">
				${entry.changes.map(change => `<li>${change}</li>`).join('')}
			</ul>
		</li>
	`).join('');

	return modal;
};
