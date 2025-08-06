import React from 'react';
import { Image, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { Svg, Path } from 'react-native-svg';
import CheckboxChecked from '@/assets2024/images/watchlist/checkbox-input.png';

const RcIconCheckboxCC = ({
  width = 25,
  height = 25,
}: {
  fillColor: string;
  strokeColor: string;
  width?: number;
  height?: number;
}) => {
  return (
    <Image
      style={{
        width,
        height,
      }}
      source={CheckboxChecked}
    />
  );
};

const RcIconUncheckboxCC = ({
  strokeColor,
  width = 24,
  height = 24,
}: {
  strokeColor: string;
  width?: number;
  height?: number;
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z"
        stroke={strokeColor}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
};

export const WatchlistCheckbox = ({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) => {
  const { isLight, colors2024 } = useTheme2024();

  return (
    <TouchableOpacity onPress={onPress}>
      {checked ? (
        <RcIconCheckboxCC
          fillColor={colors2024['orange-default']}
          strokeColor={colors2024['brand-default']}
        />
      ) : (
        <RcIconUncheckboxCC
          strokeColor={colors2024['neutral-info']}
          width={24}
          height={24}
        />
      )}
    </TouchableOpacity>
  );
};
