export const initModal = (toggleId, overlayId, { closeOnOutsideClick = false, onDismiss } = {}) => {
	const toggle = toggleId ? document.getElementById(toggleId) : null;
	const overlay = document.getElementById(overlayId);

	const close = () => {
		overlay.hidden = true;
		toggle?.classList.remove('active');
	};

	const open = () => {
		overlay.hidden = false;
		toggle?.classList.add('active');
	};

	const dismiss = () => {
		close();
		onDismiss?.();
	};

	if (toggle) {
		toggle.addEventListener('click', () => {
			if (overlay.hidden) open();
			else dismiss();
		});
	}

	if (closeOnOutsideClick) {
		document.addEventListener('click', e => {
			if (!overlay.hidden && !overlay.contains(e.target) && !toggle?.contains(e.target)) dismiss();
		});
	} else {
		overlay.addEventListener('click', e => {
			if (e.target === overlay) dismiss();
		});
	}

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape' && !overlay.hidden) dismiss();
	});

	return { toggle, overlay, open, close, dismiss };
};
