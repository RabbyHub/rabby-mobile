/* eslint-disable react-native/no-inline-styles */
import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { PerpsRiskLevelPopup } from '@/screens/Perps/components/PerpsPositionSection/PerpsRiskLevelPopup';
import { calculateDistanceToLiquidation } from '@/screens/Perps/components/PerpsPositionSection/utils';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import MarginAdd from '@/assets2024/icons/perps/PerpsProAvailableAdd.svg';
import CrossInfo from '@/assets2024/icons/perps/PerpsSimpleAccount/cross-info.svg';
import Up from '@/assets2024/icons/perps/PerpsSimpleChart/up.svg';
import Down from '@/assets2024/icons/perps/PerpsSimpleChart/down.svg';
import { hasPositivePrice, simpleLiquidationGap } from './account/model';
import { Trans, useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { PerpEditTpSlPriceTag } from './PerpEditTpSlPriceTag';
import { PerpsEditMarginPopup } from './PerpsEditMarginPopup';
import { MarketData } from '@/hooks/perps/usePerpsStore';
import { WsActiveAssetCtx } from '@rabby-wallet/hyperliquid-sdk';
import { formatPerpsCoin, handleDisplayFundingPayments } from '@/utils/perps';
import { Text } from '@/components/Typography';
import { Tip } from '@/components/Tip';
import { PerpsProDottedUnderlineText } from '@/screens/PerpsPro/components/common/PerpsProDottedUnderlineText';
import { PerpsProFundingDetailSheet } from '@/screens/PerpsPro/components/funding/PerpsProFundingDetailSheet';
import { buildPerpsProMarket } from '@/screens/PerpsPro/model/market';
import { formatPerpsProFundingRate } from '@/screens/PerpsPro/utils/format';

export const PerpsPosition: React.FC<{
  showRiskPopup: boolean;
  setShowRiskPopup: (show: boolean) => void;
  handleActionApproveStatus: () => Promise<void>;
  tpSlContextKey?: string;
  tpPending?: boolean;
  slPending?: boolean;
  tpCancelling?: boolean;
  slCancelling?: boolean;
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
  rawLiquidationPrice?: string | number | null;
  liquidationPriceText: string;
  entryPriceText: string;
  rawMarkPrice?: string | number | null;
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
  tpSlContextKey,
  tpPending,
  slPending,
  tpCancelling,
  slCancelling,
  positionData,
  coin,
  coinLogo,
  leverageMax,
  tpPrice,
  slPrice,
  markPrice,
  rawLiquidationPrice,
  liquidationPriceText,
  entryPriceText,
  rawMarkPrice,
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
  const [fundingDetailOpen, setFundingDetailOpen] = useState(false);

  const distanceLiquidation = calculateDistanceToLiquidation(
    positionData?.liquidationPrice,
    markPrice,
  );

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

  const nextFundingRate = activeAssetCtx?.funding ?? currentAssetCtx?.funding;
  // Only build the Pro market snapshot while its funding sheet is open.
  const fundingMarket = useMemo(() => {
    if (!fundingDetailOpen || !currentAssetCtx) {
      return null;
    }
    return buildPerpsProMarket({
      ...currentAssetCtx,
      funding: nextFundingRate ?? currentAssetCtx.funding,
      oraclePx: activeAssetCtx?.oraclePx ?? currentAssetCtx.oraclePx,
    });
  }, [
    fundingDetailOpen,
    currentAssetCtx,
    nextFundingRate,
    activeAssetCtx?.oraclePx,
  ]);

  if (!positionData) {
    return null;
  }

  const isFundingGains = Number(positionData.fundingPayments || 0) < 0;
  const fundingPaymentsLabel = isFundingGains
    ? t('page.perpsDetail.PerpsPosition.fundingGains')
    : t('page.perpsDetail.PerpsPosition.fundingPayments');

  const displayName = currentAssetCtx?.displayName || coin;
  const quoteAsset = currentAssetCtx?.quoteAsset || 'USDC';

  return (
    <>
      <View style={styles.section}>
        <View style={styles.header}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleBar} />
            <Text style={styles.title}>
              {t('page.perpsDetail.PerpsPosition.title')}
            </Text>
          </View>
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
          {positionData?.type === 'cross' ? (
            <Tip
              content={
                <View style={{ width: 280, padding: 8 }}>
                  <Text style={{ fontSize: 12, color: '#fff' }}>
                    {t('page.perpsDetail.PerpsPosition.crossTips')}
                  </Text>
                </View>
              }
              placement="top">
              <View style={styles.crossTag}>
                <Text style={styles.crossText}>
                  {t('page.perpsDetail.PerpsPosition.cross')}
                </Text>
                <CrossInfo color={colors2024['neutral-info']} />
              </View>
            </Tip>
          ) : (
            <View style={styles.crossTag}>
              <Text style={styles.crossText}>
                {t('page.perpsDetail.PerpsPosition.isolated')}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.positionCard}>
          <View style={styles.mainAmounts}>
            <View style={styles.marginColumn}>
              <Text style={styles.amountLabel}>
                {t('page.perpsDetail.simpleAccount.margin')}
              </Text>
              <View style={styles.marginValueRow}>
                <Text style={styles.amountValue}>
                  ${splitNumberByStep(positionData.marginUsed.toFixed(2))}
                </Text>
                {positionData.type === 'isolated' && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'page.perpsDetail.simpleAccount.margin',
                    )}
                    onPress={async () => {
                      await handleActionApproveStatus();
                      setEditMarginVisible(true);
                    }}>
                    <MarginAdd
                      width={20}
                      height={20}
                      color={colors2024['neutral-foot']}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.pnlColumn}>
              <Text style={styles.amountLabel}>
                {t('page.perpsDetail.PerpsPosition.unrealizedPnl')}
              </Text>
              <Text
                style={[
                  styles.amountValue,
                  positionData.pnl >= 0 ? styles.green : styles.red,
                ]}>
                {positionData.pnl >= 0 ? '+' : '-'}$
                {Math.abs(positionData.pnl).toFixed(2)}
              </Text>
              <View style={styles.roiRow}>
                {positionData.pnlPercent !== 0 ? (
                  <View style={styles.roiIcon}>
                    {positionData.pnlPercent > 0 ? (
                      <Up color={colors2024['green-default']} />
                    ) : (
                      <Down color={colors2024['red-default']} />
                    )}
                  </View>
                ) : null}
                <Text
                  style={[
                    styles.roi,
                    positionData.pnlPercent > 0
                      ? styles.green
                      : positionData.pnlPercent < 0
                      ? styles.red
                      : styles.neutral,
                  ]}>
                  {positionData.pnlPercent > 0 ? '+' : ''}
                  {positionData.pnlPercent.toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.divider} testID="perps-position-divider">
            <View style={styles.dividerLine} />
          </View>
          <View>
            <View style={styles.detailRow}>
              <TouchableOpacity
                onPress={() =>
                  showTipsPopup({
                    title: t('page.perpsDetail.PerpsPosition.size'),
                    desc: t('page.perpsDetail.PerpsPosition.sizeTips'),
                    buttonType: 'hyperliquid',
                  })
                }>
                <View style={styles.positionValueLabel}>
                  <Text style={styles.detailLabel}>
                    {t('page.perpsDetail.PerpsPosition.size')}
                  </Text>
                  <RcIconInfoCC
                    width={18}
                    height={18}
                    color={colors2024['neutral-info']}
                  />
                </View>
              </TouchableOpacity>
              <Text style={styles.value}>
                {positionData.positionValue.toFixed(2)} {quoteAsset} ={' '}
                {positionData.size} {formatPerpsCoin(displayName)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t('page.perpsDetail.simpleAccount.averageEntry')}
              </Text>
              <Text style={styles.value}>
                {entryPriceText === '--' ? '--' : `$${entryPriceText}`}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t('page.perpsDetail.simpleAccount.estimatedLiquidationPrice')}
              </Text>
              <Text style={styles.value}>
                {hasPositivePrice(rawLiquidationPrice)
                  ? `$${liquidationPriceText}`
                  : '--'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {t(
                  'page.perpsDetail.simpleAccount.estimatedLiquidationDistance',
                )}
              </Text>
              <Text style={styles.value}>
                {simpleLiquidationGap(rawLiquidationPrice, rawMarkPrice)}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.tpSlCard}>
          <Text style={styles.cardTitle}>
            {t('page.perpsDetail.simpleAccount.tpSl')}
          </Text>
          <View>
            <View style={[styles.tpSlRow, tpPrice ? styles.setRow : null]}>
              <Text style={styles.label}>
                {t('page.perpsDetail.simpleAccount.takeProfitPrice')}
              </Text>
              <PerpEditTpSlPriceTag
                variant="position"
                key={`${tpSlContextKey}:tp`}
                actionPending={tpPending}
                cancelPending={tpCancelling}
                estimatedPnl={takeProfitExpectedPnl}
                handleActionApproveStatus={handleActionApproveStatus}
                coin={displayName}
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
                quoteAsset={quoteAsset}
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
                  return res;
                }}
              />
            </View>
            <View style={[styles.tpSlRow, slPrice ? styles.setRow : null]}>
              <Text style={styles.label}>
                {t('page.perpsDetail.simpleAccount.stopLossPrice')}
              </Text>
              <PerpEditTpSlPriceTag
                variant="position"
                key={`${tpSlContextKey}:sl`}
                actionPending={slPending}
                cancelPending={slCancelling}
                estimatedPnl={stopLossExpectedPnl}
                leverage={positionData?.leverage}
                coin={displayName}
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
                quoteAsset={quoteAsset}
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
                  return res;
                }}
              />
            </View>
          </View>
        </View>
        <View style={styles.tpSlCard}>
          <Text style={styles.cardTitle}>
            {t('page.perpsDetail.simpleAccount.funding')}
          </Text>
          <View style={styles.detailRow}>
            <PerpsProDottedUnderlineText
              accessibilityLabel={t(
                'page.perpsDetail.simpleAccount.nextFundingRate',
              )}
              containerStyle={styles.fundingLabel}
              onPress={() => setFundingDetailOpen(true)}
              style={styles.label}>
              {t('page.perpsDetail.simpleAccount.nextFundingRate')}
            </PerpsProDottedUnderlineText>
            <Text style={styles.value}>
              {formatPerpsProFundingRate(nextFundingRate)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <PerpsProDottedUnderlineText
              accessibilityLabel={fundingPaymentsLabel}
              onPress={() =>
                showTipsPopup({
                  title: fundingPaymentsLabel,
                  desc: (
                    <Text style={styles.fundingText}>
                      <Trans
                        t={t}
                        i18nKey="page.perpsDetail.PerpsPosition.fundingTipsBold"
                        components={{
                          bold: <Text style={styles.fundingTextBold} />,
                        }}
                      />
                    </Text>
                  ),
                  buttonType: 'hyperliquid',
                })
              }
              containerStyle={styles.fundingLabel}
              style={styles.label}>
              {fundingPaymentsLabel}
            </PerpsProDottedUnderlineText>
            <Text
              style={[
                styles.value,
                isFundingGains ? styles.green : styles.red,
              ]}>
              {handleDisplayFundingPayments(positionData.fundingPayments)}
            </Text>
          </View>
        </View>
      </View>

      {fundingMarket ? (
        <PerpsProFundingDetailSheet
          market={fundingMarket}
          onClose={() => setFundingDetailOpen(false)}
          serverClock={null}
        />
      ) : null}
      <PerpsRiskLevelPopup
        isCross={positionData?.type === 'cross'}
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  const text = {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
  } as const;
  return {
    section: { marginBottom: 24, gap: 12 },
    header: { alignItems: 'center', gap: 4, flexDirection: 'row' },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginRight: 2,
    },
    sectionTitleBar: {
      width: 4,
      height: 20,
      borderRadius: 100,
      backgroundColor: '#50D2C1',
    },
    title: {
      ...text,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
    },
    positionCard: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    mainAmounts: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      minHeight: 64,
    },
    marginColumn: { flexShrink: 1, gap: 4 },
    pnlColumn: { flexShrink: 1, alignItems: 'flex-end', gap: 4 },
    amountLabel: {
      ...text,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
    },
    amountValue: {
      ...text,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      flexShrink: 1,
    },
    marginValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    roiRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    roiIcon: { width: 24.8, alignItems: 'center' },
    roi: { ...text, fontSize: 12, lineHeight: 16, fontWeight: '700' },
    divider: { height: 0, marginVertical: 12 },
    dividerLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      borderBottomWidth: 1,
      borderColor: colors2024['neutral-line'],
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 6,
    },
    positionValueLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    label: {
      ...text,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      flexShrink: 1,
    },
    detailLabel: {
      ...text,
      fontSize: 13,
      fontWeight: '500',
      color: colors2024['neutral-secondary'],
      flexShrink: 1,
    },
    value: {
      ...text,
      fontWeight: '700',
      color: colors2024['neutral-title-1'],
      textAlign: 'right',
      flexShrink: 1,
    },
    tpSlCard: {
      borderRadius: 16,
      backgroundColor: isLight
        ? colors2024['neutral-bg-1']
        : colors2024['neutral-bg-2'],
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    cardTitle: {
      ...text,
      fontWeight: '700',
      color: colors2024['neutral-body'],
      paddingVertical: 6,
    },
    tpSlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 6,
    },
    setRow: { minHeight: 52 },
    crossText: {
      ...text,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      color: colors2024['neutral-foot'],
    },
    crossTag: {
      borderRadius: 4,
      paddingHorizontal: 4,
      flexDirection: 'row',
      height: 18,
      gap: 4,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
    },
    leverageTag: {
      borderRadius: 4,
      paddingHorizontal: 4,
      justifyContent: 'center',
      alignItems: 'center',
      height: 18,
    },
    leverageText: { ...text, fontSize: 12, lineHeight: 16, fontWeight: '500' },
    longText: { color: colors2024['green-default'] },
    shortText: { color: colors2024['red-default'] },
    green: { color: colors2024['green-default'] },
    red: { color: colors2024['red-default'] },
    neutral: { color: colors2024['neutral-foot'] },
    fundingLabel: { alignSelf: 'center', flexShrink: 1 },
    fundingText: {
      ...text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '400',
      color: colors2024['neutral-secondary'],
      textAlign: 'center',
    },
    fundingTextBold: { fontFamily: 'SF Pro Rounded', fontWeight: '900' },
  };
});
