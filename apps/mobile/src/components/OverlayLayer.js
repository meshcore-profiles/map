import { memo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

const FILL_PAINT = { 'fill-color': ['get', 'color'], 'fill-opacity': ['coalesce', ['get', 'opacity'], 0.25] };
const LINE_PAINT = { 'line-color': ['get', 'color'], 'line-width': ['coalesce', ['get', 'width'], 3], 'line-dasharray': [2, 1.5] };
const POINT_PAINT = { 'circle-color': ['get', 'color'], 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' };
const LABEL_LAYOUT = { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, -1.6], 'text-allow-overlap': true };
const LABEL_PAINT = { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.5 };

// Shared layer for the tools: features carry properties.kind = 'fill' | 'line' | 'point' | 'label' and color.
export const OverlayLayer = memo(({ scope, features }) => (
	<GeoJSONSource id={`overlay-${scope}`} data={{ type: 'FeatureCollection', features }}>
		<Layer id={`overlay-fill-${scope}`} type="fill" filter={['==', ['get', 'kind'], 'fill']} paint={FILL_PAINT} />
		<Layer id={`overlay-line-${scope}`} type="line" filter={['==', ['get', 'kind'], 'line']} paint={LINE_PAINT} />
		<Layer id={`overlay-point-${scope}`} type="circle" filter={['==', ['get', 'kind'], 'point']} paint={POINT_PAINT} />
		<Layer id={`overlay-label-${scope}`} type="symbol" filter={['has', 'label']} layout={LABEL_LAYOUT} paint={LABEL_PAINT} />
	</GeoJSONSource>
));
