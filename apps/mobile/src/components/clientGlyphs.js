import { useEffect, useMemo, useReducer, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { CLIENT_ICON, clientIconFontSize, getNameIconLabel } from '@meshcore-map/core/node-utils';

// Letters the map's glyph font covers, drawn by the map itself. Anything else (emoji, symbols, other scripts) is rasterized once per label below.
const TEXT_LABEL = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}]+$/u;

const VIEW_SIZE = 96;
const IMAGE_SIZE = 192;
// The client disc on the map and the text on it keep the proportions of the website marker (CLIENT_ICON), so the label looks the same relative to the disc on both.
export const CLIENT_CIRCLE_DP = 26;
export const CLIENT_LABEL_DP = CLIENT_CIRCLE_DP * CLIENT_ICON.fontSize / CLIENT_ICON.size;
const BATCH = 12;
const SETTLE_MS = 60;

// Image scale that makes the rasterized disc the same size as the client circle layer (26 dp).
export const GLYPH_ICON_SIZE = CLIENT_CIRCLE_DP / IMAGE_SIZE;

// data URIs by image name; null marks a label that failed to render, so it is not retried.
const cache = new Map();

const labelCache = new WeakMap();

// Computed once per node: the label regexes would otherwise run for every node on each filter change.
export const splitClientLabel = node => {
	let split = labelCache.get(node);
	if (!split) {
		const label = getNameIconLabel(node.adv_name);
		split = !label ? { text: '', glyph: '' } : TEXT_LABEL.test(label) ? { text: label, glyph: '' } : { text: '', glyph: label };
		labelCache.set(node, split);
	}

	return split;
};

export const glyphImageName = glyph => `glyph-${Array.from(glyph, char => char.codePointAt(0).toString(16)).join('-')}`;

const styles = StyleSheet.create({
	offscreen: { position: 'absolute', left: -VIEW_SIZE * 2, top: 0, width: VIEW_SIZE, opacity: 0 },
});

const Batch = ({ glyphs, onDone }) => {
	const refs = useRef(new Map());

	useEffect(() => {
		const timer = setTimeout(() => {
			let left = glyphs.length;
			const finish = () => {
				if (--left === 0) onDone();
			};

			for (const glyph of glyphs) {
				const name = glyphImageName(glyph);
				const svg = refs.current.get(name);
				if (!svg) {
					cache.set(name, null);
					finish();
					continue;
				}

				try {
					svg.toDataURL(base64 => {
						cache.set(name, base64 ? `data:image/png;base64,${base64}` : null);
						finish();
					}, { width: IMAGE_SIZE, height: IMAGE_SIZE });
				} catch {
					cache.set(name, null);
					finish();
				}
			}
		}, SETTLE_MS);

		return () => clearTimeout(timer);
	}, [glyphs, onDone]);

	const center = CLIENT_ICON.size / 2;

	return (
		<View style={styles.offscreen} pointerEvents="none">
			{glyphs.map(glyph => (
				<Svg key={glyph} ref={svg => svg ? refs.current.set(glyphImageName(glyph), svg) : refs.current.delete(glyphImageName(glyph))} width={VIEW_SIZE} height={VIEW_SIZE} viewBox={`0 0 ${CLIENT_ICON.size} ${CLIENT_ICON.size}`}>
					<SvgText x={center} y={center + clientIconFontSize(glyph) * 0.35} fill="#fff" fontSize={clientIconFontSize(glyph)} fontWeight="bold" textAnchor="middle">{glyph}</SvgText>
				</Svg>
			))}
		</View>
	);
};

// Rasterizes the labels the map font cannot draw (emoji and the like) as an SVG text (like the site's client markers), a few at a time.
export const useClientGlyphs = nodes => {
	const [version, bump] = useReducer(count => count + 1, 0);

	const wanted = useMemo(() => {
		const set = new Set();
		for (const node of nodes) {
			if (node.type === 1) {
				const { glyph } = splitClientLabel(node);
				if (glyph) set.add(glyph);
			}
		}

		return [...set];
	}, [nodes]);

	const pending = useMemo(() => wanted.filter(glyph => !cache.has(glyphImageName(glyph))).slice(0, BATCH), [wanted, version]);

	const images = useMemo(() => {
		const result = {};
		for (const glyph of wanted) {
			const uri = cache.get(glyphImageName(glyph));
			if (uri) result[glyphImageName(glyph)] = uri;
		}

		return result;
	}, [wanted, version]);

	return { images, rasterizer: pending.length > 0 ? <Batch key={pending.join('')} glyphs={pending} onDone={bump} /> : null };
};
