import { useCallback, useState } from 'react';

// What is open on top of the map: one bottom sheet (filters, stats, basemap, legend, settings) or one tool, and the tool menu. Opening a tool closes the menu and the node panel.
export const usePanels = ({ onToolOpen }) => {
	const [sheet, setSheet] = useState(null);
	const [toolId, setToolId] = useState(null);
	const [toolsOpen, setToolsOpen] = useState(false);

	const closeSheet = useCallback(() => setSheet(null), []);
	const closeTool = useCallback(() => setToolId(null), []);
	const toggleTools = useCallback(() => setToolsOpen(open => !open), []);
	const openBasemapSheet = useCallback(() => setSheet('basemap'), []);
	const openLegendSheet = useCallback(() => setSheet('legend'), []);

	const openTool = useCallback(id => {
		onToolOpen();
		setToolsOpen(false);
		setToolId(id);
	}, [onToolOpen]);

	return { sheet, openSheet: setSheet, closeSheet, openBasemapSheet, openLegendSheet, toolId, openTool, closeTool, toolsOpen, toggleTools };
};
