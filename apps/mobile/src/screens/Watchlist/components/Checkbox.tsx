import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { Svg, Path } from 'react-native-svg';

const RcIconCheckboxCC = ({
  fillColor,
  strokeColor,
  width = 25,
  height = 25,
}: {
  fillColor: string;
  strokeColor: string;
  width?: number;
  height?: number;
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 25 25" fill="none">
      <Path
        d="M19 2.25C19.7293 2.25 20.4286 2.53994 20.9443 3.05566C21.4601 3.57139 21.75 4.27065 21.75 5V14.0977C20.5698 12.5449 18.1068 12.6396 17.084 14.3828L16.9814 14.5742L16.3623 15.8262L14.9834 16.0254C12.6665 16.3614 11.7423 19.2097 13.4199 20.8428L14.3516 21.75H5C4.27065 21.75 3.57139 21.4601 3.05566 20.9443C2.53994 20.4286 2.25 19.7293 2.25 19V5C2.25 4.27065 2.53994 3.57139 3.05566 3.05566C3.57139 2.53994 4.27065 2.25 5 2.25H19Z"
        fill={strokeColor}
      />
      <Path
        d="M8 11.595L10.193 13.788L14.98 9"
        stroke="white"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <Path
        d="M20.1671 23.1887C19.9606 23.0799 19.7138 23.0798 19.5073 23.1884L17.6167 24.1824C17.0971 24.4555 16.4898 24.0143 16.5891 23.4357L16.9502 21.3302C16.9897 21.1003 16.9134 20.8657 16.7462 20.703L15.215 19.2125C14.7941 18.8028 15.0261 18.0883 15.6074 18.004L17.7192 17.698C17.95 17.6645 18.1495 17.5196 18.2527 17.3105L19.1982 15.3948C19.458 14.8684 20.2086 14.8684 20.4684 15.3948L21.4139 17.3105C21.5171 17.5196 21.7166 17.6645 21.9474 17.698L24.0592 18.004C24.6405 18.0883 24.8725 18.8028 24.4516 19.2125L22.9204 20.703C22.7532 20.8657 22.6769 21.1003 22.7164 21.3302L23.0773 23.434C23.1766 24.0129 22.5686 24.4542 22.049 24.1804L20.1671 23.1887Z"
        fill={fillColor}
      />
    </Svg>
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
