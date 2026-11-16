// WAI-ARIA tabs: arrows, Home and End move the focus; only the selected tab is in the tab order.
export const initSettingsTabs = tabList => {
	const tabs = [...tabList.querySelectorAll('[role="tab"]')];

	const select = (tab, { focus = false } = {}) => {
		for (const item of tabs) {
			const active = item === tab;
			item.setAttribute('aria-selected', String(active));
			item.tabIndex = active ? 0 : -1;
			document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
		}
		if (focus) tab.focus();
	};

	tabList.addEventListener('click', e => {
		const tab = e.target.closest('[role="tab"]');
		if (tab) select(tab);
	});

	tabList.addEventListener('keydown', e => {
		const index = tabs.indexOf(document.activeElement);
		if (index === -1) return;

		const last = tabs.length - 1;
		const next = { ArrowDown: index === last ? 0 : index + 1, ArrowRight: index === last ? 0 : index + 1, ArrowUp: index === 0 ? last : index - 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
		if (next === undefined) return;

		e.preventDefault();
		select(tabs[next], { focus: true });
	});

	select(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') ?? tabs[0]);

	return { selectById: id => select(tabs.find(tab => tab.id === `settings-tab-${id}`) ?? tabs[0]) };
};
