import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { DistanceToLiquidationTag } from '@/screens/Perps/components/PerpsPositionSection/DistanceToLiquidationTag';
import { PerpsRiskLevelPopup } from '@/screens/Perps/components/PerpsPositionSection/PerpsRiskLevelPopup';
import { calculateDistanceToLiquidation } from '@/screens/Perps/components/PerpsPositionSection/utils';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import IconPerpEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import { Trans, useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { PerpEditTpSlPriceTag } from './PerpEditTpSlPriceTag';
import { PerpsEditMarginPopup } from './PerpsEditMarginPopup';
import { formatUsdValue } from '@/utils/number';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { formatPerpsPct } from '@/utils/perps';

export const PerpsPosition: React.FC<{
  showRiskPopup: boolean;
  setShowRiskPopup: (show: boolean) => void;
  handleActionApproveStatus: () => Promise<void>;
  setCurrentTpOrSl: (params: { tpPrice?: string; slPrice?: string }) => void;
  positionData?: {
    pnl: number;
    positionValue: number;
    size: number;
    marginUsed: number;
    leverage: number;
    type: 'isolated' | 'cross';
    entryPrice: number;
    liquidationPrice: string;
    autoClose: boolean;
    direction: 'Long' | 'Short';
    pnlPercent: number;
    fundingPayments: string;
  } | null;
  coin: string;
  coinLogo: string;
  leverageMax: number;
  availableBalance: number;
  tpPrice?: string;
  slPrice?: string;
  pxDecimals: number;
  szDecimals: number;
  markPrice: number;
  activeAssetCtx: WsActiveAssetCtx['ctx'] | null;
  currentAssetCtx: MarketData | null;
  handleSetAutoClose(params: {
    coin: string;
    tpTriggerPx: string;
    slTriggerPx: string;
    direction: 'Long' | 'Short';
  }): Promise<boolean>;
  handleCancelAutoClose(actionType: 'tp' | 'sl'): Promise<void>;
  handleUpdateMargin(
    coin: string,
    action: 'add' | 'reduce',
    margin: number,
  ): Promise<void>;
}> = ({
  showRiskPopup,
  setShowRiskPopup,
  handleActionApproveStatus,
  setCurrentTpOrSl,
  positionData,
  coin,
  coinLogo,
  leverageMax,
  tpPrice,
  slPrice,
  markPrice,
  availableBalance,
  pxDecimals,
  szDecimals,
  activeAssetCtx,
  currentAssetCtx,
  handleSetAutoClose,
  handleCancelAutoClose,
  handleUpdateMargin,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [editMarginVisible, setEditMarginVisible] = useState(false);

  const distanceLiquidation = calculateDistanceToLiquidation(
    positionData?.liquidationPrice,
    markPrice,
  );

  const hasStopLoss = !!slPrice;
  const { showTipsPopup } = useTipsPopup();

  // Calculate expected PNL for take profit
  const takeProfitExpectedPnl = useMemo(() => {
    if (!tpPrice || !positionData) {
      return null;
    }
    const entryPrice = positionData.entryPrice;
    const size = positionData.size;
    const pnlUsdValue =
      positionData.direction === 'Long'
        ? (Number(tpPrice) - entryPrice) * size
        : (entryPrice - Number(tpPrice)) * size;
    return pnlUsdValue;
  }, [tpPrice, positionData]);

  // Calculate expected PNL for stop loss
  const stopLossExpectedPnl = useMemo(() => {
    if (!slPrice || !positionData) {
      return null;
    }
    const entryPrice = positionData.entryPrice;
    const size = positionData.size;
    const pnlUsdValue =
      positionData.direction === 'Long'
        ? (Number(slPrice) - entryPrice) * size
        : (entryPrice - Number(slPrice)) * size;
    return pnlUsdValue;
  }, [slPrice, positionData]);

  if (!positionData) {
    return null;
  }

  return (
    <>
      <View style={styles.section}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t('page.perpsDetail.PerpsPosition.title')}
          </Text>
          <View
            style={[
              styles.leverageTag,
              {
                backgroundColor:
                  positionData?.direction === 'Long'
                    ? colors2024['green-light-1']
                    : colors2024['red-light-1'],
              },
            ]}>
            <Text
              style={[
                styles.leverageText,
                positionData?.direction === 'Long'
                  ? styles.longText
                  : styles.shortText,
              ]}>
              {positionData?.direction} {`${positionData?.leverage}x`}
            </Text>
          </View>
          <View style={styles.crossTag}>
            <Text style={styles.crossText}>
              {positionData?.type === 'cross'
                ? t('page.perpsDetail.PerpsPosition.cross')
                : t('page.perpsDetail.PerpsPosition.isolated')}
            </Text>
          </View>
        </View>
        <View style={[styles.list, styles.pnlWrapper]}>
          <Text style={styles.unrealizedPnlTitle}>
            {t('page.perpsDetail.PerpsPosition.unrealizedPnl')}
          </Text>
          <Text
            style={[
              styles.unrealizedPnl,
              positionData?.pnl >= 0 ? styles.green : styles.red,
            ]}>
            {positionData && positionData.pnl >= 0 ? '+' : '-'}$
            {Math.abs(positionData?.pnl || 0).toFixed(2)}
          </Text>
          <Text style={styles.positionValueTitle}>
            {t('page.perpsDetail.PerpsPosition.positionValue')}{' '}
            <Text style={styles.positionValue}>
              {formatUsdValue(Number(positionData?.positionValue || 0))}
            </Text>
          </Text>
        </View>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.currentPrice')}
              </Text>
            </View>
            <View>
              <Text style={styles.value}>
                ${splitNumberByStep(currentAssetCtx?.markPx || 0)}
              </Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.liquidationPrice')}
              </Text>
            </View>
            <View>
              <Text style={styles.value}>
                ${splitNumberByStep(positionData?.liquidationPrice || 0)}
              </Text>
            </View>
          </View>
          {!hasStopLoss && (
            <View style={styles.distanceCardWrapper}>
              <View style={styles.distanceCard}>
                <Text style={styles.desc}>
                  <Trans
                    t={t}
                    i18nKey={
                      positionData?.direction === 'Long'
                        ? t('page.perps.PerpsRiskPopup.liqDistanceTipsLong', {
                            distance: formatPerpsPct(distanceLiquidation),
                          })
                        : t('page.perps.PerpsRiskPopup.liqDistanceTipsShort', {
                            distance: formatPerpsPct(distanceLiquidation),
                          })
                    }
                    components={{
                      1: <Text style={styles.strong} />,
                    }}
                  />
                </Text>
              </View>
            </View>
          )}
        </View>
        <View style={[styles.header, styles.paddingTopHeader]}>
          <Text style={styles.title}>
            {t('page.perpsDetail.PerpsPosition.settings')}
          </Text>
        </View>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {positionData?.type === 'cross'
                  ? t('page.perpsDetail.PerpsPosition.marginCross')
                  : t('page.perpsDetail.PerpsPosition.marginIsolated')}
              </Text>
            </View>
            <View>
              {positionData?.type !== 'cross' ? (
                <TouchableOpacity
                  style={styles.tagContainer}
                  onPress={async () => {
                    await handleActionApproveStatus();
                    setEditMarginVisible(true);
                  }}>
                  <Text style={[styles.tagText]}>
                    $
                    {splitNumberByStep(
                      Number(positionData?.marginUsed || 0).toFixed(2),
                    )}
                  </Text>
                  <IconPerpEdit
                    width={16}
                    height={16}
                    color={colors2024['brand-default']}
                  />
                </TouchableOpacity>
              ) : (
                <Text style={styles.value}>
                  $
                  {splitNumberByStep(
                    Number(positionData?.marginUsed || 0).toFixed(2),
                  )}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.listItemColumn}>
            <View style={styles.listItemHeader}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {positionData?.direction === 'Long'
                    ? t(
                        'page.perpsDetail.PerpsOpenPositionPopup.takeProfitWhenPriceAbove',
                      )
                    : t(
                        'page.perpsDetail.PerpsOpenPositionPopup.takeProfitWhenPriceBelow',
                      )}
                </Text>
              </View>
              <View style={styles.tagWrapper}>
                <PerpEditTpSlPriceTag
                  handleActionApproveStatus={handleActionApproveStatus}
                  coin={coin}
                  actionType="tp"
                  type="hasPosition"
                  entryPrice={positionData?.entryPrice}
                  markPrice={markPrice}
                  initTpOrSlPrice={tpPrice || ''}
                  direction={positionData?.direction as 'Long' | 'Short'}
                  size={positionData?.size}
                  leverage={positionData?.leverage}
                  margin={positionData?.marginUsed}
                  liqPrice={Number(positionData?.liquidationPrice || 0)}
                  pxDecimals={pxDecimals}
                  szDecimals={szDecimals}
                  handleCancelAutoClose={async () => {
                    await handleCancelAutoClose('tp');
                  }}
                  handleSetAutoClose={async (price: string) => {
                    const res = await handleSetAutoClose({
                      coin,
                      tpTriggerPx: price,
                      slTriggerPx: '',
                      direction: positionData?.direction as 'Long' | 'Short',
                    });
                    res &&
                      setCurrentTpOrSl({
                        tpPrice: Number(price).toString(),
                      });
                  }}
                />
              </View>
            </View>
            {tpPrice && takeProfitExpectedPnl !== null && (
              <View style={styles.expectedPnlContainer}>
                <View style={styles.expectedPnlArrow} />
                <View style={styles.expectedPnlContent}>
                  <Text style={styles.expectedPnlLabel}>
                    {t(
                      'page.perpsDetail.PerpsAutoCloseModal.takeProfitExpectedPNL',
                    )}
                    :
                  </Text>
                  <Text
                    style={[
                      styles.expectedPnlValue,
                      takeProfitExpectedPnl >= 0 ? styles.green : styles.red,
                    ]}>
                    {takeProfitExpectedPnl >= 0 ? '+' : '-'}
                    {formatUsdValue(Math.abs(takeProfitExpectedPnl))}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.listItemColumn}>
            <View style={styles.listItemHeader}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {positionData?.direction === 'Long'
                    ? t(
                        'page.perpsDetail.PerpsOpenPositionPopup.stopLossWhenPriceBelow',
                      )
                    : t(
                        'page.perpsDetail.PerpsOpenPositionPopup.stopLossWhenPriceAbove',
                      )}
                </Text>
              </View>
              <View style={styles.tagWrapper}>
                <PerpEditTpSlPriceTag
                  leverage={positionData?.leverage}
                  coin={coin}
                  actionType="sl"
                  handleActionApproveStatus={handleActionApproveStatus}
                  type="hasPosition"
                  entryPrice={positionData?.entryPrice}
                  markPrice={markPrice}
                  initTpOrSlPrice={slPrice || ''}
                  direction={positionData?.direction as 'Long' | 'Short'}
                  size={positionData?.size}
                  margin={positionData?.marginUsed}
                  liqPrice={Number(positionData?.liquidationPrice || 0)}
                  pxDecimals={pxDecimals}
                  szDecimals={szDecimals}
                  handleCancelAutoClose={async () => {
                    await handleCancelAutoClose('sl');
                  }}
                  handleSetAutoClose={async (price: string) => {
                    const res = await handleSetAutoClose({
                      coin,
                      tpTriggerPx: '',
                      slTriggerPx: price,
                      direction: positionData?.direction as 'Long' | 'Short',
                    });
                    res &&
                      setCurrentTpOrSl({
                        slPrice: Number(price).toString(),
                      });
                  }}
                />
              </View>
            </View>
            {slPrice && stopLossExpectedPnl !== null && (
              <View style={styles.expectedPnlContainer}>
                <View style={styles.expectedPnlArrow} />
                <View style={styles.expectedPnlContent}>
                  <Text style={styles.expectedPnlLabel}>
                    {t(
                      'page.perpsDetail.PerpsAutoCloseModal.stopLossExpectedPNL',
                    )}
                    :
                  </Text>
                  <Text
                    style={[
                      styles.expectedPnlValue,
                      stopLossExpectedPnl >= 0 ? styles.green : styles.red,
                    ]}>
                    {stopLossExpectedPnl >= 0 ? '+' : '-'}
                    {formatUsdValue(Math.abs(stopLossExpectedPnl))}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.header, styles.paddingTopHeader]}>
          <Text style={styles.title}>
            {t('page.perpsDetail.PerpsPosition.details')}
          </Text>
        </View>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.entryPrice')}
              </Text>
            </View>
            <View>
              <Text style={styles.value}>
                ${splitNumberByStep(positionData?.entryPrice || 0)}
              </Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <TouchableOpacity
              onPress={() => {
                showTipsPopup({
                  title: t('page.perpsDetail.PerpsPosition.size'),
                  desc: t('page.perpsDetail.PerpsPosition.sizeTips'),
                });
              }}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsPosition.size')}
                </Text>
                <RcIconInfoCC
                  width={18}
                  height={18}
                  color={colors2024['neutral-info']}
                />
              </View>
            </TouchableOpacity>
            <View>
              <Text style={styles.value}>
                $
                {splitNumberByStep(
                  Number(positionData?.positionValue || 0).toFixed(2),
                )}{' '}
                = {positionData?.size} {coin}
              </Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.direction')}
              </Text>
            </View>
            <View>
              <Text style={styles.value}>
                {positionData?.direction} {positionData?.leverage}x
              </Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.marginMode')}
              </Text>
            </View>
            <View>
              <Text style={styles.value}>
                {positionData?.type === 'cross'
                  ? t('page.perpsDetail.PerpsPosition.cross')
                  : t('page.perpsDetail.PerpsPosition.isolated')}
              </Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <TouchableOpacity
              onPress={() => {
                showTipsPopup({
                  title:
                    Number(positionData?.fundingPayments || 0) > 0
                      ? t('page.perpsDetail.PerpsPosition.fundingGains')
                      : t('page.perpsDetail.PerpsPosition.fundingPayments'),
                  desc:
                    Number(positionData?.fundingPayments || 0) > 0
                      ? t('page.perpsDetail.PerpsPosition.fundingGainsTips')
                      : t('page.perpsDetail.PerpsPosition.fundingPaymentsTips'),
                });
              }}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {Number(positionData?.fundingPayments || 0) > 0
                    ? t('page.perpsDetail.PerpsPosition.fundingGains')
                    : t('page.perpsDetail.PerpsPosition.fundingPayments')}
                </Text>
                <RcIconInfoCC
                  width={18}
                  height={18}
                  color={colors2024['neutral-info']}
                />
              </View>
            </TouchableOpacity>
            <View>
              <Text style={styles.value}>
                {Number(positionData?.fundingPayments || 0) === 0
                  ? ''
                  : Number(positionData?.fundingPayments || 0) > 0
                  ? '+'
                  : '-'}
                ${Math.abs(Number(positionData?.fundingPayments || 0))}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <PerpsRiskLevelPopup
        visible={!!showRiskPopup}
        direction={positionData?.direction}
        pxDecimals={pxDecimals}
        onClose={() => {
          setShowRiskPopup(false);
        }}
        distanceLiquidation={distanceLiquidation}
        currentPrice={markPrice}
        liquidationPrice={Number(positionData?.liquidationPrice)}
      />
      <PerpsEditMarginPopup
        visible={editMarginVisible}
        activeAssetCtx={activeAssetCtx}
        currentAssetCtx={currentAssetCtx}
        pnl={positionData?.pnl}
        pnlPercent={positionData?.pnlPercent}
        marginUsed={positionData?.marginUsed}
        positionSize={positionData?.size}
        direction={positionData?.direction as 'Long' | 'Short'}
        coin={coin}
        marginMode={positionData?.type as 'cross' | 'isolated'}
        coinLogo={coinLogo}
        markPrice={markPrice}
        entryPrice={positionData?.entryPrice}
        leverage={Number(positionData?.leverage || 1)}
        leverageMax={leverageMax}
        pxDecimals={pxDecimals}
        szDecimals={szDecimals}
        availableBalance={availableBalance}
        liquidationPx={Number(positionData?.liquidationPrice || 0)}
        handlePressRiskTag={() => {
          setShowRiskPopup(true);
        }}
        onCancel={() => {
          setEditMarginVisible(false);
        }}
        onConfirm={async (action: 'add' | 'reduce', margin: number) => {
          await handleUpdateMargin(coin, action, margin);
          setEditMarginVisible(false);
        }}
      />
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  section: {
    marginBottom: 24,
    gap: 12,
  },
  tagContainer: {
    borderRadius: 100,
    backgroundColor: colors2024['brand-light-1'],
    paddingVertical: 4,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 6,
  },
  tagText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
  },
  header: {
    paddingHorizontal: 4,
    alignItems: 'center',
    // marginBottom: 12,
    gap: 6,
    flexDirection: 'row',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
  },
  unrealizedPnlTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  distanceCardWrapper: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  distanceCard: {
    borderRadius: 6,
    paddingTop: 10,
    paddingBottom: 10,
    flex: 1,
    backgroundColor: colors2024['brand-light-1'],
  },
  desc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['brand-default'],
    textAlign: 'center',
  },
  strong: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
    color: colors2024['brand-default'],
  },
  paddingTopHeader: {
    marginTop: 12,
  },
  unrealizedPnl: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    textAlign: 'center',
  },
  positionValueTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    marginTop: 8,
  },
  positionValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
  pnlWrapper: {
    paddingVertical: 16,
    gap: 8,
  },
  list: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  listItemContainer: {
    padding: 16,
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
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  listItemRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listSub: {
    padding: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    marginTop: 12,
  },
  listSubItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  listSubItemLabel: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  listItemMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 20,
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  leverageTag: {
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    height: 18,
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
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  red: {
    color: colors2024['red-default'],
  },
  green: {
    color: colors2024['green-default'],
  },
  tagWrapper: {
    alignItems: 'flex-end',
  },
  listItemColumn: {
    display: 'flex',
    flexDirection: 'column',
    padding: 16,
  },
  listItemHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expectedPnlContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-card-1'],
    borderRadius: 8,
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-end',
    position: 'relative',
    marginTop: 12,
    // marginRight: 4,
  },
  expectedPnlArrow: {
    position: 'absolute',
    top: -6,
    right: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-card-1'],
  },
  expectedPnlContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  expectedPnlLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  expectedPnlValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
}));
