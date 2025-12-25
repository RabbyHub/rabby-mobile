import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, TouchableOpacity, View } from 'react-native';
import EmptySummaryCard from '../../EmptySummaryCard';
import { useLendingSummary } from '../../hooks';
import TokenIcon from '../TokenIcon';
import { formatApy } from '../../utils/format';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { DisplayPoolReserveInfo } from '../../type';
import { CHAINS_ENUM } from '@debank/common';
import { useSelectedMarket } from '../../hooks';
import { API_ETH_MOCK_ADDRESS } from '@aave/contract-helpers';
import RightArrowCC from '@/assets2024/icons/common/right-cc.svg';
import { CustomMarket } from '../../config/market';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

const EmptyItem = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { displayPoolReserves, getTargetReserve, iUserSummary } =
    useLendingSummary();
  const { chainEnum, marketKey } = useSelectedMarket();

  const filterReserves = useMemo(() => {
    return displayPoolReserves
      ?.filter(item => {
        if (
          isSameAddress(
            item.reserve.underlyingAsset,
            API_ETH_MOCK_ADDRESS.toLowerCase(),
          ) &&
          marketKey === CustomMarket.proto_mainnet_v3
        ) {
          return true;
        }
        return item.reserve.symbol.toLowerCase().includes('usd');
      })
      .sort((a, b) => {
        return (
          Number(b.reserve.totalLiquidityUSD || '0') -
          Number(a.reserve.totalLiquidityUSD || '0')
        );
      })
      .slice(0, 5);
  }, [displayPoolReserves, marketKey]);

  const handlePressItem = useCallback(
    (item: DisplayPoolReserveInfo) => {
      const reserve = getTargetReserve(item.reserve.underlyingAsset);
      const userSummary = iUserSummary;
      if (!reserve || !userSummary) {
        return;
      }
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SUPPLY_ACTION_DETAIL,
        reserve,
        userSummary,
        onClose: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          handleStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        },
      });
    },
    [colors2024, getTargetReserve, iUserSummary],
  );

  if (!filterReserves?.length) {
    return (
      <View style={styles.container}>
        <EmptySummaryCard />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <EmptySummaryCard />
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.headerToken}>
            {t('page.Lending.list.headers.token')}
          </Text>

          <Text style={styles.headerApy}>{t('page.Lending.tvl')}</Text>
          <Text style={styles.headerTvl}>{t('page.Lending.apy')}</Text>
        </View>
        {filterReserves?.map(item => (
          <TouchableOpacity
            key={`${item.reserve.underlyingAsset}-${item.reserve.symbol}`}
            style={styles.item}
            onPress={() => handlePressItem(item)}>
            <View style={styles.left}>
              <TokenIcon
                tokenSymbol={item.reserve.symbol}
                chainSize={0}
                chain={chainEnum || CHAINS_ENUM.ETH}
              />
              <View style={styles.symbolContainer}>
                <Text style={styles.symbol}>{item.reserve.symbol}</Text>
              </View>
            </View>
            <Text style={styles.tvl}>
              {formatUsdValueKMB(Number(item.reserve.totalLiquidityUSD || '0'))}
            </Text>
            <View style={styles.right}>
              <Text style={styles.apy}>
                {formatApy(Number(item.reserve.supplyAPY || '0'))}
              </Text>
              <RightArrowCC
                width={14}
                height={14}
                color={colors2024['green-default']}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default EmptyItem;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    gap: 12,
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 120,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 24,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  headerToken: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  headerApy: {
    width: 60,
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    textAlign: 'right',
  },
  headerTvl: {
    width: 100,
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    textAlign: 'right',
  },
  headerMySupplies: {
    width: 80,
    marginLeft: 8,
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
    textAlign: 'right',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    marginTop: 8,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolContainer: {
    gap: 2,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tvl: {
    width: 100,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'right',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  apy: {
    width: 60,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'right',
  },
  right: {
    width: 100,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  yourSupplied: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
