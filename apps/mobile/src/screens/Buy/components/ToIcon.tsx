import { useTheme2024 } from '@/hooks/theme';
import Svg, { Path, Rect, SvgProps } from 'react-native-svg';

export const BuyToIcon = ({ style }: { style: SvgProps['style'] }) => {
  const { colors2024 } = useTheme2024();
  return (
    <Svg
      // xmlns="http://www.w3.org/2000/svg"
      width="45"
      height="45"
      viewBox="0 0 45 45"
      fill="none"
      style={style}>
      <Rect
        x="0.5"
        y="0.5"
        width="44"
        height="44"
        rx="22"
        fill={colors2024['neutral-bg-2']}
      />
      <Rect
        x="0.5"
        y="0.5"
        width="44"
        height="44"
        rx="22"
        stroke={colors2024['neutral-line']}
      />
      <Path
        d="M28.1165 25.4531L22.3571 31.2125L16.5977 25.4531"
        stroke={colors2024['neutral-info']}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M28.1165 16L22.3571 21.7594L16.5977 16"
        stroke={colors2024['neutral-secondary']}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
