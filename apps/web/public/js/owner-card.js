import { t, tRaw, plural } from './i18n.js';
import { escapeHtml } from './pathtools.js';
import { openLightbox } from './lightbox.js';

const COLOR_REGEX = /^#[0-9a-f]{6}$/;
const POWER_KEYS = ['grid', 'solar', 'battery', 'poe', 'other'];
const ANTENNA_TYPES = ['omni', 'dir'];
const PATH_HASH_SIZES = [1, 2, 3];

const CACHE_TTL = 5 * 60 * 1000;

const profiles = new Map();
let keys = null;
let keysRequest = null;
let keysLoadedAt = 0;

const isFresh = loadedAt => Date.now() - loadedAt < CACHE_TTL;

const loadKeys = () => {
	if (keysRequest && !isFresh(keysLoadedAt)) keysRequest = null;

	keysRequest ??= fetch('/api/v1/node-profile-keys')
		.then(res => {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		})
		.then(json => {
			keys = new Set(json.data);
			keysLoadedAt = Date.now();
			return keys;
		})
		.catch(err => {
			keysRequest = null;
			console.error('Failed to load the profile list:', err);
			return null;
		});

	return keysRequest;
};

const loadProfile = key => {
	const cached = profiles.get(key);
	if (cached && isFresh(cached.loadedAt)) return cached.promise;

	const entry = { loadedAt: Date.now(), settled: false, value: null };
	entry.promise = fetch(`/api/v1/node-profile/${key}`)
		.then(res => {
			if (res.status === 404) return null;
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		})
		.then(json => json?.data ?? null)
		.catch(err => {
			profiles.delete(key);
			console.error('Failed to load the node profile:', err);
			return null;
		})
		.then(value => {
			entry.value = value;
			entry.settled = true;
			return value;
		});

	profiles.set(key, entry);
	return entry.promise;
};

export const peekOwner = rawKey => {
	const key = rawKey.toLowerCase();
	if (keys && isFresh(keysLoadedAt) && !keys.has(key)) return null;

	const entry = profiles.get(key);
	return entry?.settled && isFresh(entry.loadedAt) ? entry.value : undefined;
};

export const loadOwner = async rawKey => {
	const key = rawKey.toLowerCase();
	const known = await loadKeys();
	return known && !known.has(key) ? null : loadProfile(key);
};

const assetUrl = (base, path) => (typeof path === 'string' && (/^\/(?!\/)/).test(path) ? `${base}${encodeURI(path)}` : null);

const initial = name => escapeHtml([...String(name).trim()][0]?.toUpperCase() || '?');

const countChip = (count, unitKey) => (count ? `<span class="owner-chip"><b>${count}</b> ${escapeHtml(plural(count, tRaw(`map:ownerCard.units.${unitKey}`)))}</span>` : '');

const detailRow = (label, value, tags = []) => {
	const chips = tags.filter(Boolean);
	if (!value && !chips.length) return '';
	return `<div><dt>${label}</dt><dd>${value ? `<span>${escapeHtml(value)}</span>` : ''}${chips.length ? `<span class="owner-tags">${chips.map(tag => `<span class="owner-tag"${tag.title ? ` title="${escapeHtml(tag.title)}"` : ''}>${escapeHtml(tag.text ?? tag)}</span>`).join('')}</span>` : ''}</dd></div>`;
};

const formatMemberSince = iso => {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(window.MAP_CONFIG.languageCode, { year: 'numeric', month: 'long' });
};

const thousands = value => Number(value).toLocaleString(window.MAP_CONFIG.languageCode);

const joinParts = parts => parts.filter(Boolean).join(' · ');

const hint = (text, key) => ({ text, title: t(`map:ownerCard.hints.${key}`) });

const has = value => value != null && value !== '';

const buildDetails = node => {
	const antennaTags = [
		has(node.gain) ? hint(`${node.gain} dBi`, 'gain') : null,
		ANTENNA_TYPES.includes(node.antennaType) ? hint(joinParts([t(`map:ownerCard.antennaTypes.${node.antennaType}`), has(node.heading) ? `${node.heading}°` : null]), 'antennaType') : null,
	];
	const deviceTags = [
		has(node.height) ? hint(t('map:ownerCard.mountedAt', { height: node.height }), 'height') : null,
		PATH_HASH_SIZES.includes(node.pathHash) ? { text: t(`map:ownerCard.pathHashSizes.${node.pathHash}`), title: t('map:ownerCard.pathHash') } : null,
	];
	const powerSource = POWER_KEYS.includes(node.powerSource) ? t(`map:ownerCard.power.${node.powerSource}`) : node.power;
	const powerTags = [has(node.solarPanel) ? hint(`${node.solarPanel} W`, 'solarPanel') : null, has(node.battery) ? hint(`${thousands(node.battery)} mAh`, 'battery') : null];

	return {
		device: detailRow(t('map:ownerCard.model'), node.model, deviceTags),
		power: [
			detailRow(t('map:ownerCard.antenna'), node.antenna, antennaTags),
			detailRow(t('map:ownerCard.txPower'), has(node.txPower) ? `${node.txPower} dBm` : null),
			detailRow(t('map:ownerCard.powerSource'), powerSource, powerTags),
		].join(''),
	};
};

const buildBoard = (boardImage, name) => `<span class="owner-board"><img src="${escapeHtml(boardImage)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"></span>`;

const buildGallery = (photos, name) => (photos.length ? `
	<div class="owner-gallery">
		${photos.map((src, i) => `<button type="button" data-photo="${i}" aria-label="${escapeHtml(t('map:ownerCard.openPhoto', { n: i + 1, total: photos.length }))}"><img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"></button>`).join('')}
	</div>` : '');

const buildSpotlight = ({ node, owner, profileUrl }) => {
	const href = `${profileUrl}/profile/${encodeURIComponent(owner.slug)}${node.path}`;

	return `
		<a class="node-spotlight" href="${escapeHtml(href)}" target="_blank" rel="noopener">
			<span class="node-spotlight__title">${t('map:spotlight.title')}</span>
			<span class="node-spotlight__text">${t('map:spotlight.text')}</span>
			<span class="node-spotlight__cta">${t('map:spotlight.open')}<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#chevron-right"></use></svg></span>
		</a>`;
};

const photoUrls = ({ node, profileUrl }) => node.photos.map(photo => assetUrl(profileUrl, photo.path)).filter(Boolean);

const buildCard = ({ owner, node, profileUrl }) => {
	const profileHref = `${profileUrl}/profile/${encodeURIComponent(owner.slug)}`;
	const avatar = assetUrl(profileUrl, owner.avatar);
	const photos = photoUrls({ node, profileUrl });
	const place = [owner.city, owner.country].filter(Boolean).join(', ');
	const since = owner.memberSince ? formatMemberSince(owner.memberSince) : null;
	const { device, power } = buildDetails(node);
	const withBoard = !photos.length && Boolean(node.boardImage);

	const chips = [
		countChip(owner.counts.repeaters, 'repeater'),
		countChip(owner.counts.roomServers, 'roomServer'),
		countChip(owner.counts.companions, 'companion'),
	].join('');

	const websites = owner.websites.map(domain => `<a class="owner-site" href="https://${escapeHtml(domain)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(domain)}</a>`).join('');

	return {
		html: `
		<div class="owner-card__eyebrow">${t('map:ownerCard.operatorOf')}</div>
		<a class="owner-card__main" href="${escapeHtml(profileHref)}" target="_blank" rel="noopener" title="${t('map:ownerCard.viewProfile')}">
			<span class="owner-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : initial(owner.nick)}</span>
			<span class="owner-id">
				<span class="owner-name">
					<span class="owner-name__text">${escapeHtml(owner.nick)}</span>
					${chips ? `<span class="owner-chips">${chips}</span>` : ''}
				</span>
				${place ? `<span class="owner-sub">${escapeHtml(place)}</span>` : ''}
				${since ? `<span class="owner-since">${escapeHtml(t('map:ownerCard.memberSince', { date: since }))}</span>` : ''}
			</span>
		</a>
		${websites ? `<div class="owner-sites">${websites}</div>` : ''}
		${device || power || photos.length || withBoard || node.note ? `
		<div class="owner-node">
			${withBoard ? `<div class="owner-node__head">${buildBoard(node.boardImage, node.model || node.name)}${device ? `<dl class="owner-node__details">${device}</dl>` : ''}</div>
			${power ? `<dl class="owner-node__details">${power}</dl>` : ''}` : `${buildGallery(photos, node.name)}
			${device || power ? `<dl class="owner-node__details">${device}${power}</dl>` : ''}`}
			${node.note ? `<p class="owner-note">${escapeHtml(node.note)}</p>` : ''}
		</div>` : ''}`,
	};
};

const accentOf = data => (COLOR_REGEX.test(data.owner.accent) ? data.owner.accent : null);

const accentAttr = data => {
	const accent = accentOf(data);
	return accent ? ` data-accent="${accent}"` : '';
};

const applyAccent = (root, data) => {
	const accent = accentOf(data);
	if (!accent) return;

	for (const el of root.querySelectorAll('.owner-card, .node-spotlight-slot')) el.style.setProperty('--owner-accent', accent);
};

export const ownerCardPlaceholder = publicKey => {
	const key = escapeHtml(publicKey);
	const data = peekOwner(publicKey);
	if (!data) return `<section class="owner-card" data-owner-key="${key}" aria-label="${t('map:ownerCard.aria')}" hidden></section>`;

	return `<section class="owner-card" data-owner-key="${key}" data-ready aria-label="${t('map:ownerCard.aria')}"${accentAttr(data)}>${buildCard(data).html}</section>`;
};

export const spotlightPlaceholder = publicKey => {
	const data = peekOwner(publicKey);
	return data ? `<div class="node-spotlight-slot"${accentAttr(data)}>${buildSpotlight(data)}</div>` : '<div class="node-spotlight-slot" hidden></div>';
};

const bindGallery = (slot, data) => {
	if (slot.dataset.bound) return;
	slot.dataset.bound = 'true';

	const photos = photoUrls(data);
	slot.addEventListener('click', e => {
		const button = e.target.closest('[data-photo]');
		if (button) openLightbox(photos, Number(button.dataset.photo), button);
	});
};

export const hydrateOwnerCard = async (root, onChange) => {
	const slot = root?.querySelector('.owner-card[data-owner-key]');
	if (!slot) return;

	const publicKey = slot.dataset.ownerKey;
	const ready = peekOwner(publicKey);
	if (ready) {
		bindGallery(slot, ready);
		applyAccent(root, ready);
		if (slot.dataset.ready) return;
	} else if (ready === null) {
		return;
	}

	slot.classList.add('is-loading');
	slot.setAttribute('aria-busy', 'true');
	slot.hidden = false;
	onChange?.(true);

	const data = ready ?? await loadOwner(publicKey);
	if (!slot.isConnected) return;

	slot.classList.remove('is-loading');
	slot.removeAttribute('aria-busy');

	if (!data) {
		slot.hidden = true;
		onChange?.(false);
		return;
	}

	slot.innerHTML = buildCard(data).html;
	bindGallery(slot, data);

	const spotlight = root.querySelector('.node-spotlight-slot');
	if (spotlight) {
		spotlight.innerHTML = buildSpotlight(data);
		spotlight.hidden = false;
	}
	applyAccent(root, data);
	onChange?.(true);
};
