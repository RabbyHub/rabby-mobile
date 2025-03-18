import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

interface ManIconProps extends SvgProps {
  bgColor?: string;
  iconColor?: string;
}

export const ManIcon = ({
  bgColor = 'rgba(112, 132, 255, 0.4)',
  iconColor = '#ffffff',
  ...props
}: ManIconProps) => (
  <Svg width={34} height={35} viewBox="0 0 34 35" fill="none" {...props}>
    <Path
      d="M33.8264 17.1001C33.8264 7.65597 26.26 0 16.9264 0C7.59276 0 0.0263672 7.65597 0.0263672 17.1001C0.0263672 26.5442 7.59276 34.2002 16.9264 34.2002C26.26 34.2002 33.8264 26.5442 33.8264 17.1001Z"
      fill={bgColor}
      fillOpacity={1}
    />
    <Path
      d="M22.6416 26.23H11.3013C10.2661 26.23 9.41504 25.3689 9.41504 24.3215C9.41504 20.9001 12.1524 18.1071 15.5567 18.1071H18.3861C21.7675 18.1071 24.5278 20.8768 24.5278 24.3215C24.5278 25.3689 23.6997 26.23 22.6416 26.23ZM16.9829 17.6183C14.3836 17.6183 12.2674 15.477 12.2674 12.8469C12.2444 10.2169 14.3606 8.07556 16.9599 8.07556C19.5592 8.07556 21.6755 10.2169 21.6755 12.8469C21.6985 15.5003 19.5592 17.6183 16.9829 17.6183Z"
      fill={iconColor}
    />
  </Svg>
);

export default ManIcon;
