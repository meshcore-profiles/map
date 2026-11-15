import { initModal } from './modal.js';

export const initLegendPanel = () => {
	const { toggle, overlay: panel, open, close } = initModal('legend-toggle', 'legend-overlay');
	return { toggle, panel, open, close };
};
