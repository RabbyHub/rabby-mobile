import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import {
  MarketDataMap,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { sortBy } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { PerpsPositionItem } from './PerpsPositionItem';
import { AssetPosition } from '@rabby-wallet/hyperliquid-sdk';

export const PerpsPositionSection: React.FC<{
  positionAndOpenOrders?: PositionAndOpenOrder[];
  marketDataMap: MarketDataMap;
  onClosePosition: (position: AssetPosition['position']) => void;
}> = ({ positionAndOpenOrders, marketDataMap, onClosePosition }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();

  const list = useMemo(() => {
    return sortBy(
      positionAndOpenOrders || [],
      item => -item.position.marginUsed,
    );
  }, [positionAndOpenOrders]);

  if (!positionAndOpenOrders?.length) {
    return null;
  }
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('page.perps.positions')}</Text>
      </View>
      <View style={styles.content}>
        {list.map((item, index) => {
          return (
            <PerpsPositionItem
              key={index}
              item={item.position}
              onClosePosition={() => onClosePosition(item.position)}
              marketData={marketDataMap[item.position.coin]}
              onPress={() => {
                navigation.push(RootNames.StackTransaction, {
                  screen: RootNames.PerpsMarketDetail,
                  params: {
                    market: item.position.coin,
                  },
                });
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  sectionAction: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionActionText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'right',
  },
  sectionActionIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
}));
