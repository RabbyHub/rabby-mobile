import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { PerpsProTradeOrderType } from '../../model/trade';

export const PerpsProOrderTypeIcon: React.FC<{
  backgroundColor: string;
  footColor: string;
  titleColor: string;
  type: PerpsProTradeOrderType;
}> = React.memo(({ backgroundColor, footColor, titleColor, type }) => (
  <Svg fill="none" height={24} viewBox="0 0 24 24" width={24}>
    <Line
      stroke={footColor}
      strokeDasharray={[2, 2]}
      strokeLinecap="round"
      x1="1.5"
      x2="22.5"
      y1="16.5"
      y2="16.5"
    />
    {type === 'conditional' ? (
      <Line
        stroke={footColor}
        strokeDasharray={[2, 2]}
        strokeLinecap="round"
        x1="1.5"
        x2="22.5"
        y1="8.5"
        y2="8.5"
      />
    ) : null}
    {type === 'limit' ? (
      <Path
        d="M2 5.00019L11 5L18 16"
        stroke={titleColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    ) : type === 'market' ? (
      <Line
        stroke={titleColor}
        strokeLinecap="round"
        strokeWidth="1.5"
        x1="6.06066"
        x2="18"
        y1="4"
        y2="15.9393"
      />
    ) : (
      <Path
        d="M12 13L18 18L21 15M3 22L15 9L17 11L21 6"
        stroke={titleColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    )}
    <Circle
      cx={type === 'conditional' ? '11.5' : '18.5'}
      cy={type === 'conditional' ? '12.5' : '16.5'}
      fill={titleColor}
      r="2"
      stroke={backgroundColor}
    />
  </Svg>
));

PerpsProOrderTypeIcon.displayName = 'PerpsProOrderTypeIcon';
