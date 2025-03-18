import { Svg, Rect, Path } from 'react-native-svg';
export const RcIconSwitchCC = ({
  fillColor,
  strokeColor,
  width = 25,
  height = 24,
}: {
  fillColor: string;
  strokeColor: string;
  width?: number;
  height?: number;
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 25 24" fill="none">
      <Rect x="0.5" width="24" height="24" rx="12" fill={fillColor} />
      <Path
        d="M7.5 10.375H18.5L16.5 8"
        stroke={strokeColor}
        strokeWidth="1.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 14.5H7.5L9.5 16.875"
        stroke={strokeColor}
        strokeWidth="1.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
