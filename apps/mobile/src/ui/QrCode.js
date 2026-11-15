import { memo, useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { encode } from 'uqr';
import { colors } from '../theme';

// Dark modules as one path: every horizontal run of them is a single rectangle, which keeps the native view tree small.
const buildPath = modules => {
	const parts = [];

	modules.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			if (!row[x]) {
				x++;
				continue;
			}

			const start = x;
			while (x < row.length && row[x]) x++;
			parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
		}
	});

	return parts.join('');
};

// A QR code on a white background (scanners need dark on light whatever the app theme); the quiet zone is part of the encoded matrix.
export const QrCode = memo(({ value, size }) => {
	const { data, path } = useMemo(() => {
		const { data: modules } = encode(value, { ecc: 'M', border: 1 });
		return { data: modules, path: buildPath(modules) };
	}, [value]);

	return (
		<Svg width={size} height={size} viewBox={`0 0 ${data.length} ${data.length}`} shapeRendering="crispEdges">
			<Rect width={data.length} height={data.length} fill={colors.qrLight} />
			<Path d={path} fill={colors.qrDark} />
		</Svg>
	);
});
