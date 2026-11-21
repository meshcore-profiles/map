import * as ntools from './node-utils.js';
import { CONTACT_ADDABLE_TYPES, NODE_TYPE_KEYS, formatTimeAgo } from '/core/nodes.js';
import { buildContactUrl } from '/core/contact.js';
import { radioValue } from '/core/radio-filter-utils.js';
import { t, tRaw, plural } from './i18n.js';
import { escapeHtml } from './pathtools.js';
import { getPresetLabel } from './radio-presets.js';
import { ownerCardPlaceholder, spotlightPlaceholder } from './owner-card.js';

// The HTML of a node's popup (and the mobile node panel): header with QR code, info table, actions. Copy buttons carry data-copy-value and are handled by map.js.

const typeName = type => t(`map:nodeTypes.${NODE_TYPE_KEYS[type]}`);
const statusDesc = status => t(`map:updateStatus.${status}`);

const radioParamDesc = {
	'bw': { unit: ' kHz', short: '' },
	'freq': { unit: ' MHz', short: '' },
	'sf': { unit: '', short: 'SF' },
	'cr': { unit: '', short: 'CR' },
};
const radioParamLabel = key => t(`map:radioParams.${key}`);

const statusBadgeClass = {
	'none': 'badge-status-none',
	'recent': 'badge-status-recent',
	'stale': 'badge-status-stale',
	'old': 'badge-status-old',
	'extinct': 'badge-status-extinct',
};

const columnOrder = ['public_key', 'link', 'inserted_date', 'updated_date', 'coords', 'preset', 'params'];
const paramOrder = ['freq', 'bw', 'sf', 'cr'];

export const timeAgo = msec => formatTimeAgo(msec, { t, tRaw, plural });
const getRadioParamKeys = params => paramOrder.filter(key => radioValue(params, key) !== 'unknown');

const withCopyButton = (displayHtml, copyValue, btnTitle, textTitle = '') => `
	<span class="copy-cell">
		<span class="copy-cell-text"${textTitle ? ` title="${textTitle}"` : ''}>${displayHtml}</span>
		<button type="button" class="copy-icon-btn" title="${btnTitle}" aria-label="${btnTitle}" data-copy-value="${escapeHtml(copyValue)}">
			<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#copy"></use></svg>
		</button>
	</span>`;

const columns = {
	coords: {
		label: t('map:columns.coords'),
		value: val => withCopyButton(
			`<a href="https://google.com/maps/place/${val.replace(' ', '')}" class="coords-link" target="_blank" rel="noopener nofollow">${val}</a>`,
			val,
			t('map:copyCoords')
		),
	},
	inserted_date: {
		label: t('map:columns.insertedDate'),
		value: val => {
			const dt = new Date(val);
			return `<time datetime="${val}" title="${ntools.formatDateTime(dt)}">${timeAgo(dt.getTime())}</time>`;
		},
	},
	updated_date: {
		label: t('map:columns.updatedDate'),
		value: val => {
			const dt = new Date(val);
			return `<time datetime="${val}" title="${ntools.formatDateTime(dt)}">${timeAgo(dt.getTime())}</time>`;
		},
	},
	public_key: {
		label: t('map:columns.publicKey'),
		value: val => withCopyButton(
			escapeHtml(ntools.truncateKey(val)),
			val,
			t('map:copyPublicKey'),
			escapeHtml(val)
		),
	},
	preset: {
		label: t('map:columns.preset'),
		value: getPresetLabel,
	},
	params: {
		label: t('map:columns.params'),
		value: val => {
			const keys = getRadioParamKeys(val);
			if (!keys.length) return t('map:noRadioData');
			return `<span class="param-chips">${keys.map(key => {
				const paramKey = radioParamDesc[key];
				const text = `${paramKey.short}${val[key]}${paramKey.unit}`;
				return `<span class="param-chip" title="${radioParamLabel(key)}">${escapeHtml(text)}</span>`;
			}).join('')}</span>`;
		},
	},
	link: {
		label: t('map:columns.link'),
		value: uint8arr => `<button type="button" class="copy-link-btn" data-copy-value="meshcore://${ntools.bytesToHex(uint8arr)}">${t('map:copyLinkButton')}</button>`,
	},
};

const getTable = node => '<table class="node-info"><tbody>' +
	'<tr>' + columnOrder.flatMap(key => node[key] || key === 'preset' || key === 'params' ? [`<td><b>${columns[key].label}</b></td><td>${columns[key].value ? columns[key].value(node[key]) : node[key]}</td>`] : []).join('</tr><tr>') + '</tr>' +
'</tbody></table>';

const discordTimestamp = date => `<t:${Math.floor(date.getTime() / 1000)}:R>`;
export const getShareUrl = node => `${location.origin}${location.pathname}?node=${node.public_key}`;

const getNodeInfoText = node => {
	const lines = [`# [${node.adv_name}](${getShareUrl(node)}) (${typeName(node.type)})`, ''];

	lines.push(`- **${t('map:columns.publicKey')}:** \`${node.public_key}\``);
	if (node.status) lines.push(`- **${t('map:infoStatus')}:** ${statusDesc(node.status)}`);
	lines.push(`- **${t('map:columns.insertedDate')}:** ${ntools.formatDateTime(node.insertDate)} (${discordTimestamp(node.insertDate)})`);
	if (node.updatedDate) lines.push(`- **${t('map:columns.updatedDate')}:** ${ntools.formatDateTime(node.updatedDate)} (${discordTimestamp(node.updatedDate)})`);
	lines.push(`- **${t('map:columns.coords')}:** \`${node.coords}\` ([${t('common:mapWord')}](https://google.com/maps/place/${node.coords.replace(' ', '')}))`);

	lines.push(`- **${t('map:columns.preset')}:** ${getPresetLabel(node.params)}`);
	const radioKeys = getRadioParamKeys(node.params);
	if (radioKeys.length) {
		lines.push(`- **${t('map:columns.params')}:**`);
		for (const key of radioKeys) {
			const paramKey = radioParamDesc[key];
			lines.push(`  - ${radioParamLabel(key)}: ${node.params[key]}${paramKey.unit}`);
		}
	} else {
		lines.push(`- **${t('map:columns.params')}:** ${t('map:noRadioData')}`);
	}

	return lines.join('\n');
};

export const getNodePopupHTML = node => {
	const userActionUrl = encodeURI(localStorage.getItem('userActionUrl') || '');
	const userActionLabel = localStorage.getItem('userActionLabel') || '';
	const userActionAnchor = userActionUrl ? `<a target="_blank" rel="noopener noreferrer" href="https://${userActionUrl}?nodes=${node.public_key}">${userActionLabel}</a>` : '';
	const qrValue = buildContactUrl(node);
	const statusClass = statusBadgeClass[node.status] || '';
	const shareUrl = getShareUrl(node);
	const canAddContact = CONTACT_ADDABLE_TYPES.includes(node.type);

	return `
		<div class="node-layout">
		<div class="node-main">
		<div class="node-header">
			<div class="node-qr" data-qr-value="${escapeHtml(qrValue)}"></div>
			<div class="node-header-info">
				<div class="node-title">
					<span class="node-title-text">${escapeHtml(node.adv_name)}</span>
					<button type="button" class="copy-icon-btn" title="${t('map:copyName')}" aria-label="${t('map:copyName')}" data-copy-value="${escapeHtml(node.adv_name)}">
						<svg class="icon" aria-hidden="true"><use href="/icons/icons.svg#copy"></use></svg>
					</button>
				</div>
				<div class="node-badges">
					<span class="badge">${typeName(node.type)}</span>
					${node.status ? `<span class="badge ${statusClass}"><span class="badge-dot"></span>${statusDesc(node.status)}</span>` : ''}
				</div>
			</div>
		</div>
		${getTable(node)}
		${spotlightPlaceholder(node.public_key)}
		<div class="user-actions">
			<div class="user-actions-left">
				<button type="button" class="copy-link-btn" data-copy-value="${escapeHtml(shareUrl)}" title="${t('map:shareTitle')}">${t('common:share')}</button>
				<button type="button" class="copy-link-btn" data-copy-value="${escapeHtml(getNodeInfoText(node))}" title="${t('map:copyInfoTitle')}">${t('map:copyInfo')}</button>
				${canAddContact ? `<a class="action-link-btn" href="${escapeHtml(qrValue)}" title="${t('map:addContactTitle')}" data-meshcore-link>${t('map:addContact')}</a>` : ''}
			</div>
			<div class="user-actions-right">
				<button type="button" class="node-deletion-btn" data-delete-node="${escapeHtml(node.public_key)}" data-node-name="${escapeHtml(node.adv_name)}" title="${t('map:reportDeletionTitle')}">${t('map:reportDeletion')}</button>
				${userActionAnchor}
			</div>
		</div>
		</div>
		${ownerCardPlaceholder(node.public_key)}
		</div>`;
};
