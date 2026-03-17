import React from 'react';
import { Platform } from 'react-native';

import { MarketCategoryContent } from '../Market/components/MarketCategoryContent';

const isAndroid = Platform.OS === 'android';

export function MemeContent({
  headerSpacerHeight = isAndroid ? 46 : 44,
}: {
  headerSpacerHeight?: number;
}) {
  return (
    <MarketCategoryContent
      categoryId="meme"
      sortFields={['display_order', 'volume_24h', 'fdv', 'price_change_24h']}
      headerSpacerHeight={headerSpacerHeight}
    />
  );
}
