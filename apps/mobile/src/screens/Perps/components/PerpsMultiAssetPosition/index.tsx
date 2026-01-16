import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { useFindAccountByAddress } from '@/screens/Address/components/MultiAssets/hooks/share';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useShallow } from 'zustand/react/shallow';
import { Account } from '@/core/services/preference';
import {
  AssetPosition,
  ClearinghouseState,
} from '@rabby-wallet/hyperliquid-sdk';
import RcIconHyperliquid from '@/assets2024/icons/perps/IconHyperliquid.svg';
import { AssetAvatar } from '@/components';
import { formatUsdValue } from '@/utils/number';
import { DistanceToLiquidationTag } from '../PerpsPositionSection/DistanceToLiquidationTag';
import { useTranslation } from 'react-i18next';
import RcArrowRight2CC from '@/assets2024/icons/perps/IconAssetArrowCC.svg';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { ellipsisAddress } from '@/utils/address';
import { calculateDistanceToLiquidation } from '../PerpsPositionSection/utils';
import { useMemoizedFn } from 'ahooks';
import { PerpsRiskLevelPopup } from '../PerpsPositionSection/PerpsRiskLevelPopup';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { switchPerpsAccountBeforeNavigate } from '@/hooks/perps/usePerpsStore';

const calculateMarkPrice = (position: AssetPosition['position']) => {
  const entryPxDecimals = position.entryPx?.split('.')[1]?.length || 2;
  const px = Number(position.positionValue) / Math.abs(Number(position.szi));
  return px.toFixed(entryPxDecimals);
};

interface AssetPositionWithAccount {
  account: Account;
  assetPositions: AssetPosition;
  logoUrl: string;
}

const AssetPositionItem = ({
  item,
  onShowRiskPopup,
  isSingleAddress,
}: {
  item: AssetPositionWithAccount;
  onShowRiskPopup: (item: AssetPositionWithAccount) => void;
  isSingleAddress?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const logoUrl = item.logoUrl;
  const coin = item.assetPositions.position.coin.toUpperCase();
  const leverageType = item.assetPositions.position.leverage.type || 'isolated';
  const side = Number(item.assetPositions.position.szi) > 0 ? 'Long' : 'Short';
  const leverageText = `${item.assetPositions.position.leverage.value}x`;
  const liquidationPx = item.assetPositions.position.liquidationPx;
  const marginUsed = item.assetPositions.position.marginUsed;
  const isUp = Number(item.assetPositions.position.unrealizedPnl) >= 0;
  const absPnlUsd = Math.abs(
    Number(item.assetPositions.position.unrealizedPnl),
  );
  const calculateMarkPx = useMemo(() => {
    return calculateMarkPrice(item.assetPositions.position);
  }, [item]);
  const handleDistanceTagPress = useCallback(() => {
    onShowRiskPopup(item);
  }, [item, onShowRiskPopup]);
  const pnlText = `${isUp ? '+' : '-'}${formatUsdValue(absPnlUsd)}`;
  const handlePress = useCallback(() => {
    switchPerpsAccountBeforeNavigate(item.account);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.PerpsMarketDetail,
      params: {
        // account: item.account,
        market: coin,
      },
    });
  }, [item, coin, navigation]);
  const handleHyperliquidPress = useCallback(() => {
    switchPerpsAccountBeforeNavigate(item.account);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Perps,
    });
  }, [item, navigation]);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.mainContent}>
        {/* Left section: icon + coin info */}
        <View style={styles.leftSection}>
          <View style={styles.coinInfoRow}>
            <AssetAvatar logo={logoUrl} size={28} />
            <View style={styles.coinInfo}>
              <View style={styles.coinNameRow}>
                <Text style={styles.coinName}>{coin}</Text>
                <View style={styles.crossTag}>
                  <Text style={styles.crossText}>
                    {leverageType === 'cross'
                      ? t('page.perpsDetail.PerpsPosition.cross')
                      : t('page.perpsDetail.PerpsPosition.isolated')}
                  </Text>
                </View>
              </View>
              {!isSingleAddress && (
                <View style={styles.coinNameRow}>
                  <WalletIcon
                    width={14}
                    height={14}
                    type={item.account.brandName}
                    address={item.account.address}
                  />
                  <Text style={styles.address}>
                    {item.account.aliasName ||
                      ellipsisAddress(item.account.address)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.tagRow}>
            <View
              style={[
                styles.leverageTag,
                {
                  backgroundColor:
                    side === 'Long'
                      ? colors2024['green-light-1']
                      : colors2024['red-light-1'],
                },
              ]}>
              <Text
                style={[
                  styles.leverageText,
                  side === 'Long' ? styles.longText : styles.shortText,
                ]}>
                {side} {leverageText}
              </Text>
            </View>
            <DistanceToLiquidationTag
              liquidationPrice={liquidationPx}
              markPrice={calculateMarkPx}
              onPress={handleDistanceTagPress}
            />
          </View>
        </View>

        {/* Right section: price + PnL */}
        <View style={styles.rightSection}>
          <Text style={styles.priceText}>
            {formatUsdValue(Number(marginUsed))}
          </Text>
          <Text
            style={[
              styles.pnlText,
              isUp ? styles.pnlTextUp : styles.pnlTextDown,
            ]}>
            {pnlText}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.bottomSection}
        onPress={handleHyperliquidPress}>
        <RcIconHyperliquid width={16} height={16} />
        <Text style={styles.hyperliquidText}>
          {t('page.perps.assetPage.hyperliquidPosition')}
        </Text>
        <RcArrowRight2CC color={colors2024['neutral-secondary']} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export const PerpsSingleAssetPosition: React.FC<{
  account?: Account | null;
}> = ({ account }) => {
  const { clearinghouseStateMap, marketDataMap } = perpsStore(
    useShallow(s => ({
      clearinghouseStateMap: s.clearinghouseStateMap,
      marketDataMap: s.marketDataMap,
    })),
  );
  const [selectedPositionKey, setSelectedPositionKey] = useState<{
    address: string;
    coin: string;
  } | null>(null);
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });
  const clearinghouseState =
    clearinghouseStateMap[account?.address.toLowerCase() || ''];

  const dataList = useMemo(() => {
    const resList: AssetPositionWithAccount[] = [];
    if (!account) {
      return resList;
    }

    if (!clearinghouseState) {
      return resList;
    }
    const assetPositions = clearinghouseState.assetPositions;
    assetPositions.forEach(assetPosition => {
      resList.push({
        account,
        assetPositions: assetPosition,
        logoUrl:
          marketDataMap[assetPosition.position.coin.toUpperCase()]?.logoUrl ||
          '',
      });
    });
    return resList.sort((a, b) => {
      return (
        Number(b.assetPositions.position.marginUsed) -
        Number(a.assetPositions.position.marginUsed)
      );
    });
  }, [clearinghouseState, marketDataMap, account]);

  const riskPopupData = useMemo(() => {
    if (!selectedPositionKey) {
      return null;
    }

    const { address, coin } = selectedPositionKey;
    const freshAssetPosition = clearinghouseState?.assetPositions.find(
      p => p.position.coin === coin,
    );

    if (!freshAssetPosition) {
      return null;
    }

    const markPrice = Number(calculateMarkPrice(freshAssetPosition.position));
    const liquidationPrice = Number(
      freshAssetPosition.position.liquidationPx || 0,
    );

    const distanceLiquidation = calculateDistanceToLiquidation(
      freshAssetPosition.position.liquidationPx,
      markPrice,
    );
    return {
      distanceLiquidation,
      direction:
        Number(freshAssetPosition.position.szi || 0) > 0
          ? 'Long'
          : ('Short' as 'Long' | 'Short'),
      currentPrice: markPrice,
      pxDecimals:
        freshAssetPosition.position.entryPx?.split('.')[1]?.length || 2,
      liquidationPrice,
    };
  }, [selectedPositionKey, clearinghouseState]);

  const handleShowRiskPopup = useCallback(
    (item: AssetPositionWithAccount) => {
      setSelectedPositionKey({
        address: item.account.address,
        coin: item.assetPositions.position.coin,
      });
    },
    [setSelectedPositionKey],
  );

  const handleCloseRiskPopup = useCallback(() => {
    setSelectedPositionKey(null);
  }, [setSelectedPositionKey]);

  return (
    <>
      {!!dataList.length && (
        <View style={[styles.container, styles.singleAssetContainer]}>
          {dataList.map(item => {
            return (
              <AssetPositionItem
                key={`${item.account.address}-${item.assetPositions.position.coin}`}
                isSingleAddress={true}
                item={item}
                onShowRiskPopup={() => handleShowRiskPopup(item)}
              />
            );
          })}
        </View>
      )}
      {riskPopupData && (
        <PerpsRiskLevelPopup
          direction={riskPopupData.direction}
          visible={!!riskPopupData}
          pxDecimals={riskPopupData?.pxDecimals || 2}
          onClose={handleCloseRiskPopup}
          distanceLiquidation={riskPopupData.distanceLiquidation}
          currentPrice={riskPopupData.currentPrice}
          liquidationPrice={riskPopupData.liquidationPrice}
        />
      )}
    </>
  );
};

export const PerpsMultiAssetPosition: React.FC = () => {
  const getAccountByAddress = useFindAccountByAddress();
  const { clearinghouseStateMap, marketDataMap } = perpsStore(
    useShallow(s => ({
      clearinghouseStateMap: s.clearinghouseStateMap,
      marketDataMap: s.marketDataMap,
    })),
  );
  const [selectedPositionKey, setSelectedPositionKey] = useState<{
    address: string;
    coin: string;
  } | null>(null);
  const { styles, colors, colors2024 } = useTheme2024({ getStyle });

  const dataList = useMemo(() => {
    const resList: AssetPositionWithAccount[] = [];

    Object.keys(clearinghouseStateMap).forEach(item => {
      const clearinghouseState = clearinghouseStateMap[item];
      if (!clearinghouseState) {
        return null;
      }
      const account = getAccountByAddress(item);
      if (!account) {
        return null;
      }
      const assetPositions = clearinghouseState.assetPositions;
      assetPositions.forEach(assetPosition => {
        resList.push({
          account,
          assetPositions: assetPosition,
          logoUrl:
            marketDataMap[assetPosition.position.coin.toUpperCase()]?.logoUrl ||
            '',
        });
      });
    });

    return resList.sort((a, b) => {
      return (
        Number(b.assetPositions.position.marginUsed) -
        Number(a.assetPositions.position.marginUsed)
      );
    });
  }, [clearinghouseStateMap, getAccountByAddress, marketDataMap]);

  const riskPopupData = useMemo(() => {
    if (!selectedPositionKey) {
      return null;
    }

    const { address, coin } = selectedPositionKey;
    const clearinghouseState = clearinghouseStateMap[address];
    const freshAssetPosition = clearinghouseState?.assetPositions.find(
      p => p.position.coin === coin,
    );

    if (!freshAssetPosition) {
      return null;
    }

    const markPrice = Number(calculateMarkPrice(freshAssetPosition.position));
    const liquidationPrice = Number(
      freshAssetPosition.position.liquidationPx || 0,
    );

    const distanceLiquidation = calculateDistanceToLiquidation(
      freshAssetPosition.position.liquidationPx,
      markPrice,
    );
    return {
      distanceLiquidation,
      direction:
        Number(freshAssetPosition.position.szi || 0) > 0
          ? 'Long'
          : ('Short' as 'Long' | 'Short'),
      currentPrice: markPrice,
      pxDecimals:
        freshAssetPosition.position.entryPx?.split('.')[1]?.length || 2,
      liquidationPrice,
    };
  }, [selectedPositionKey, clearinghouseStateMap]);

  const handleShowRiskPopup = useCallback(
    (item: AssetPositionWithAccount) => {
      setSelectedPositionKey({
        address: item.account.address,
        coin: item.assetPositions.position.coin,
      });
    },
    [setSelectedPositionKey],
  );

  const handleCloseRiskPopup = useCallback(() => {
    setSelectedPositionKey(null);
  }, [setSelectedPositionKey]);

  return (
    <>
      <View style={styles.container}>
        {dataList.map(item => {
          return (
            <AssetPositionItem
              key={`${item.account.address}-${item.assetPositions.position.coin}`}
              item={item}
              onShowRiskPopup={() => handleShowRiskPopup(item)}
            />
          );
        })}
      </View>
      {riskPopupData && (
        <PerpsRiskLevelPopup
          direction={riskPopupData.direction}
          visible={!!riskPopupData}
          pxDecimals={riskPopupData?.pxDecimals || 2}
          onClose={handleCloseRiskPopup}
          distanceLiquidation={riskPopupData.distanceLiquidation}
          currentPrice={riskPopupData.currentPrice}
          liquidationPrice={riskPopupData.liquidationPrice}
        />
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    width: '100%',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  singleAssetContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    width: '100%',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    // paddingHorizontal: 14,
    paddingVertical: 14,
    paddingBottom: 12,
  },
  mainContent: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  coinInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinInfo: {
    flex: 1,
  },
  coinNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  crossText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  crossTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leverageTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 20,
  },
  leverageText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  longText: {
    color: colors2024['green-default'],
  },
  shortText: {
    color: colors2024['red-default'],
  },
  distanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.8,
  },
  distanceDotContainer: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    alignItems: 'center',
    paddingHorizontal: 14,
    borderTopColor: colors2024['neutral-line'],
  },
  distanceDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  pnlPctText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  pnlPctUp: {
    color: colors2024['green-default'],
  },
  pnlPctDown: {
    color: colors2024['red-default'],
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 5,
  },
  priceText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  pnlText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  pnlTextUp: {
    color: colors2024['green-default'],
  },
  pnlTextDown: {
    color: colors2024['red-default'],
  },
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
  hyperliquidText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 6,
    marginRight: 2,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
