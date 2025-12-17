import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import {
  MarketDataMap,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { sortBy } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Dimensions,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PerpsPositionItem } from './PerpsPositionItem';
import { AssetPosition } from '@rabby-wallet/hyperliquid-sdk';
import { useMemoizedFn } from 'ahooks';
import { sleep } from '@/utils/async';
import Toast from 'react-native-root-toast';
import { toast } from '@/components/Toast';
export const PerpsPositionSection: React.FC<{
  positionAndOpenOrders?: PositionAndOpenOrder[];
  marketDataMap: MarketDataMap;
  handleShowRiskPopup: (coin: string) => void;
  handleCloseRiskPopup: () => void;
  handleActionApproveStatus: () => Promise<void>;
  onClosePosition: (position: AssetPosition['position']) => Promise<void>;
}> = ({
  positionAndOpenOrders,
  marketDataMap,
  handleShowRiskPopup,
  handleCloseRiskPopup,
  handleActionApproveStatus,
  onClosePosition,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const list = useMemo(() => {
    return sortBy(
      positionAndOpenOrders || [],
      item => -item.position.marginUsed,
    );
  }, [positionAndOpenOrders]);

  const handleCloseAll = useMemoizedFn(async () => {
    await handleActionApproveStatus();
    Alert.alert(
      t('page.perps.closeAllConfirmTitle'),
      t('page.perps.closeAllConfirmMessage'),
      [
        {
          text: t('global.cancel'),
          style: 'default',
        },
        {
          text: t('global.confirm'),
          style: 'default',
          onPress: async () => {
            for (const item of list) {
              await onClosePosition(item.position);
              await sleep(10);
            }
          },
        },
      ],
    );
  });

  if (!positionAndOpenOrders?.length) {
    return null;
  }
  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('page.perps.positions')}</Text>
        <TouchableOpacity
          onPress={() => {
            handleCloseAll();
          }}>
          <Text style={styles.sectionActionText}>
            {t('page.perps.closeAll')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {list.map((item, index) => {
          return (
            <PerpsPositionItem
              key={index}
              item={item.position}
              openOrders={item.openOrders}
              marketData={marketDataMap[item.position.coin]}
              onPress={() => {
                navigation.push(RootNames.StackTransaction, {
                  screen: RootNames.PerpsMarketDetail,
                  params: {
                    market: item.position.coin,
                  },
                });
              }}
              onShowRiskPopup={handleShowRiskPopup}
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
    fontWeight: '900',
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
    gap: 8,
  },
}));
