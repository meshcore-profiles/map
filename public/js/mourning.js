(() => {
	const notice = document.getElementById('mourning-notice');
	const storageKey = 'mourningNoticeShown:krakow-2026-11';

	try {
		if (localStorage.getItem(storageKey) === '1') return;
	} catch (err) {
		console.warn('Nie można odczytać stanu komunikatu o żałobie:', err);
	}

	notice.showModal();

	try {
		localStorage.setItem(storageKey, '1');
	} catch (err) {
		console.warn('Nie można zapisać stanu komunikatu o żałobie:', err);
	}
})();
