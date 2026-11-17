import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// The down arrow of dropdowns and collapsible rows; flipped with `up`.
export const Chevron = ({ up = false }) => (
	<Svg width={16} height={16} viewBox="0 0 24 24" style={up ? { transform: [{ rotate: '180deg' }] } : null}>
		<Path d="M6 9l6 6 6-6" fill="none" stroke={colors.textMuted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
	</Svg>
);
