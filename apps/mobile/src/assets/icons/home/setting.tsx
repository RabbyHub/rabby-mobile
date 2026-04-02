import Svg, { Rect, Path } from 'react-native-svg';
import { View } from 'react-native';

interface Props {
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  style?: any;
}

export default function Setting({
  width = 26,
  height = 26,
  color = '#192945',
  backgroundColor = 'rgba(211, 216, 224, 0.1)',
  style,
}: Props) {
  return (
    <View style={style}>
      <Svg width={width} height={height} viewBox="0 0 26 26" fill="none">
        <Rect width={26} height={26} rx={13} fill={backgroundColor} />
        <Path
          d="M18.6677 13.7426L14.3939 17.6882C13.6725 18.3532 12.4383 17.884 12.4383 16.9457V15.1062H8.1426C7.5127 15.1062 7 14.6336 7 14.0531V11.9469C7 11.3664 7.5127 10.8938 8.1426 10.8938H12.4383V9.05433C12.4383 8.116 13.6725 7.64684 14.3939 8.31177L18.6677 12.2574C19.1108 12.6692 19.1108 13.3308 18.6677 13.7426Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}
