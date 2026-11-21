import { t, tRaw, plural } from './i18n.js';
import { escapeHtml } from './pathtools.js';
import { openLightbox } from './lightbox.js';

const COLOR_REGEX = /^#[0-9a-f]{6}$/;
const POWER_KEYS = ['grid', 'solar', 'battery', 'poe', 'other'];
const ANTENNA_TYPES = ['omni', 'dir'];
const PATH_HASH_SIZES = [1, 2, 3];

const cache = new Map();

const fetchProfile = key => {
	if (cache.has(key)) return cache.get(key);

	const request = fetch(`/api/v1/node-profile/${key}`)
		.then(res => {
			if (res.status === 404) return null;
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		})
		.then(json => json?.data ?? null)
		.catch(err => {
			cache.delete(key);
			console.error('Failed to load the node profile:', err);
			return null;
		});

	cache.set(key, request);
	return request;
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

const has = value => value != null && value !== '';

const buildDetails = node => {
	const antennaTags = [
		has(node.gain) ? `${node.gain} dBi` : null,
		ANTENNA_TYPES.includes(node.antennaType) ? joinParts([t(`map:ownerCard.antennaTypes.${node.antennaType}`), has(node.heading) ? `${node.heading}°` : null]) : null,
	];
	const deviceTags = [
		has(node.height) ? t('map:ownerCard.mountedAt', { height: node.height }) : null,
		PATH_HASH_SIZES.includes(node.pathHash) ? { text: t(`map:ownerCard.pathHashSizes.${node.pathHash}`), title: t('map:ownerCard.pathHash') } : null,
	];
	const powerSource = POWER_KEYS.includes(node.powerSource) ? t(`map:ownerCard.power.${node.powerSource}`) : node.power;
	const powerTags = [has(node.solarPanel) ? `${node.solarPanel} W` : null, has(node.battery) ? `${thousands(node.battery)} mAh` : null];

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

const buildCard = ({ owner, node, profileUrl }) => {
	const profileHref = `${profileUrl}/profile/${encodeURIComponent(owner.slug)}`;
	const nodeHref = `${profileHref}${node.path}`;
	const avatar = assetUrl(profileUrl, owner.avatar);
	const photos = node.photos.map(photo => assetUrl(profileUrl, photo.path)).filter(Boolean);
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
		photos,
		html: `
		<div class="owner-card__eyebrow">${t('map:ownerCard.operatorOf')}</div>
		<a class="owner-card__main" href="${escapeHtml(profileHref)}" target="_blank" rel="noopener" title="${t('map:ownerCard.viewProfile')}">
			<span class="owner-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" width="72" height="72" loading="lazy" decoding="async">` : initial(owner.nick)}</span>
			<span class="owner-id">
				<span class="owner-name">
					<span class="owner-name__text">${escapeHtml(owner.nick)}</span>
				</span>
				<span class="owner-sub">@${escapeHtml(owner.slug)}${place ? ` · ${escapeHtml(place)}` : ''}</span>
				${since ? `<span class="owner-since">${escapeHtml(t('map:ownerCard.memberSince', { date: since }))}</span>` : ''}
			</span>
		</a>
		${chips ? `<div class="owner-chips">${chips}</div>` : ''}
		${websites ? `<div class="owner-sites">${websites}</div>` : ''}
		${device || power || photos.length || withBoard || node.note ? `
		<div class="owner-node">
			${withBoard ? `<div class="owner-node__head">${buildBoard(node.boardImage, node.model || node.name)}${device ? `<dl class="owner-node__details">${device}</dl>` : ''}</div>
			${power ? `<dl class="owner-node__details">${power}</dl>` : ''}` : `${buildGallery(photos, node.name)}
			${device || power ? `<dl class="owner-node__details">${device}${power}</dl>` : ''}`}
			${node.note ? `<p class="owner-note">${escapeHtml(node.note)}</p>` : ''}
		</div>` : ''}
		<div class="owner-card__foot">
			<a class="action-link-btn" href="${escapeHtml(profileHref)}" target="_blank" rel="noopener">${t('map:ownerCard.viewProfile')}</a>
			<a class="action-link-btn" href="${escapeHtml(nodeHref)}" target="_blank" rel="noopener">${t('map:spotlight.open')}</a>
		</div>`,
	};
};

export const ownerCardPlaceholder = publicKey => `<section class="owner-card" data-owner-key="${escapeHtml(publicKey)}" aria-label="${t('map:ownerCard.aria')}" hidden></section>`;

export const hydrateOwnerCard = async (root, onChange) => {
	const slot = root?.querySelector('.owner-card[data-owner-key]');
	if (!slot) return;

	const data = await fetchProfile(slot.dataset.ownerKey.toLowerCase());
	if (!data || !slot.isConnected) return;

	const accent = COLOR_REGEX.test(data.owner.accent) ? data.owner.accent : null;
	if (accent) slot.style.setProperty('--owner-accent', accent);
	const { html, photos } = buildCard(data);
	slot.innerHTML = html;
	slot.addEventListener('click', e => {
		const button = e.target.closest('[data-photo]');
		if (button) openLightbox(photos, Number(button.dataset.photo), button);
	});
	slot.hidden = false;

	const spotlight = root.querySelector('.node-spotlight-slot');
	if (spotlight) {
		spotlight.innerHTML = buildSpotlight(data);
		spotlight.hidden = false;
	}
	onChange?.();
};
