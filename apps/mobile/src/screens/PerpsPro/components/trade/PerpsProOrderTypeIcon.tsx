import React from 'react';
import type { SvgProps } from 'react-native-svg';
import LimitIcon from '@/assets2024/icons/perps/PerpsProOrderTypeLimit.svg';
import MarketIcon from '@/assets2024/icons/perps/PerpsProOrderTypeMarket.svg';
import ConditionalIcon from '@/assets2024/icons/perps/PerpsProOrderTypeConditional.svg';
import type { PerpsProTradeOrderType } from '../../model/trade';

const icons: Record<
  PerpsProTradeOrderType,
  React.FC<SvgProps & { fill2?: string }>
> = {
  limit: LimitIcon,
  market: MarketIcon,
  conditional: ConditionalIcon,
};

export const PerpsProOrderTypeIcon: React.FC<{
  backgroundColor: string;
  footColor: string;
  titleColor: string;
  type: PerpsProTradeOrderType;
}> = React.memo(({ backgroundColor, footColor, titleColor, type }) => {
  const Icon = icons[type];
  return (
    <Icon
      width={24}
      height={24}
      color={titleColor}
      stroke={footColor}
      fill2={backgroundColor}
    />
  );
});

PerpsProOrderTypeIcon.displayName = 'PerpsProOrderTypeIcon';
