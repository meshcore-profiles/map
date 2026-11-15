import { createElement } from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { ICONS } from './iconData';

const SHAPES = { Circle, Line, Path, Polygon, Polyline, Rect };

// Renders a glyph shared with the website. "currentColor" in the source maps to the color prop.
export const Icon = ({ name, size = 22, color = '#fff' }) => {
	const spec = ICONS[name];
	if (!spec) return null;

	const resolve = value => value === 'currentColor' ? color : value;
	const rootProps = spec.stroke ? { fill: 'none', stroke: color, strokeWidth: spec.strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } : spec.fill ? { fill: color } : {};

	return (
		<Svg width={size} height={size} viewBox={spec.viewBox} {...rootProps}>
			{spec.nodes.map(([tag, props], index) => createElement(SHAPES[tag], { key: index, ...Object.fromEntries(Object.entries(props).map(([k, v]) => [k, resolve(v)])) }))}
		</Svg>
	);
};
