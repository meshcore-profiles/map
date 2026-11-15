import { createElement, memo, useMemo } from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';
import { ICONS } from './iconData';

const SHAPES = { Circle, Line, Path, Polygon, Polyline, Rect };

// Renders a glyph shared with the website. "currentColor" in the source maps to the color prop.
export const Icon = memo(({ name, size = 22, color = '#fff' }) => {
	const spec = ICONS[name];
	const shapes = useMemo(() => spec?.nodes.map(([tag, props], index) => {
		const resolved = Object.fromEntries(Object.entries(props).map(([key, value]) => [key, value === 'currentColor' ? color : value]));
		return createElement(SHAPES[tag], { key: index, ...resolved });
	}), [spec, color]);

	if (!spec) return null;

	const rootProps = spec.stroke ? { fill: 'none', stroke: color, strokeWidth: spec.strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } : spec.fill ? { fill: color } : {};

	return <Svg width={size} height={size} viewBox={spec.viewBox} {...rootProps}>{shapes}</Svg>;
});
