import RcIconInfoCC from '@/assets2024/icons/perps/IconInfoCC.svg';
import { AppSwitch } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { DistanceToLiquidationTag } from '@/screens/Perps/components/PerpsPositionSection/DistanceToLiquidationTag';
import { PerpsRiskLevelPopup } from '@/screens/Perps/components/PerpsPositionSection/PerpsRiskLevelPopup';
import { calculateDistanceToLiquidation } from '@/screens/Perps/components/PerpsPositionSection/utils';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import IconPerpEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { PerpEditTpSlPriceTag } from './PerpEditTpSlPriceTag';
import { PerpsEditMarginPopup } from './PerpsEditMarginPopup';

export const PerpsPosition: React.FC<{
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
  handleSetAutoClose(params: {
    coin: string;
    tpTriggerPx: string;
    slTriggerPx: string;
    direction: 'Long' | 'Short';
  }): Promise<void>;
  handleCancelAutoClose(actionType: 'tp' | 'sl'): Promise<void>;
  handleUpdateMargin(
    coin: string,
    action: 'add' | 'reduce',
    margin: number,
  ): Promise<void>;
}> = ({
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
  handleSetAutoClose,
  handleCancelAutoClose,
  handleUpdateMargin,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [editMarginVisible, setEditMarginVisible] = useState(false);
  const [showRiskPopup, setShowRiskPopup] = useState(false);

  const distanceLiquidation = calculateDistanceToLiquidation(
    positionData?.liquidationPrice,
    markPrice,
  );

  const { showTipsPopup } = useTipsPopup();

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
          <DistanceToLiquidationTag
            liquidationPrice={positionData?.liquidationPrice}
            markPrice={markPrice}
            onPress={() => setShowRiskPopup(true)}
          />
        </View>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.pnl')}
              </Text>
            </View>
            <View>
              <Text
                style={[
                  styles.value,
                  positionData && positionData.pnl >= 0
                    ? styles.green
                    : styles.red,
                ]}>
                {positionData && positionData.pnl >= 0 ? '+' : '-'}$
                {Math.abs(positionData?.pnl || 0).toFixed(2)} (
                {positionData && positionData.pnl >= 0 ? '+' : ''}
                {positionData?.pnlPercent.toFixed(2)}%)
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
                {positionData?.type === 'cross'
                  ? t('page.perpsDetail.PerpsPosition.marginCross')
                  : t('page.perpsDetail.PerpsPosition.marginIsolated')}
              </Text>
            </View>
            <View>
              {positionData?.type !== 'cross' ? (
                <TouchableOpacity
                  style={styles.tagContainer}
                  onPress={() => setEditMarginVisible(true)}>
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
          <View style={styles.listItem}>
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
            <PerpEditTpSlPriceTag
              coin={coin}
              actionType="tp"
              type="hasPosition"
              entryPrice={positionData?.entryPrice}
              markPrice={markPrice}
              initTpOrSlPrice={tpPrice || ''}
              direction={positionData?.direction as 'Long' | 'Short'}
              size={positionData?.size}
              margin={positionData?.marginUsed}
              liqPrice={Number(positionData?.liquidationPrice || 0)}
              pxDecimals={pxDecimals}
              szDecimals={szDecimals}
              handleCancelAutoClose={async () => {
                await handleCancelAutoClose('tp');
              }}
              handleSetAutoClose={async (price: string) => {
                await handleSetAutoClose({
                  coin,
                  tpTriggerPx: price,
                  slTriggerPx: '',
                  direction: positionData?.direction as 'Long' | 'Short',
                });
              }}
            />
          </View>
          <View style={styles.listItem}>
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
            <PerpEditTpSlPriceTag
              coin={coin}
              actionType="sl"
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
                await handleSetAutoClose({
                  coin,
                  tpTriggerPx: '',
                  slTriggerPx: price,
                  direction: positionData?.direction as 'Long' | 'Short',
                });
              }}
            />
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
                  title: t('page.perpsDetail.PerpsPosition.liquidationPrice'),
                  desc: t(
                    'page.perpsDetail.PerpsPosition.liquidationPriceTips',
                  ),
                });
              }}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsPosition.liquidationPrice')}
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
                ${splitNumberByStep(positionData?.liquidationPrice || 0)}
              </Text>
            </View>
          </View>
          <View style={styles.listItem}>
            <TouchableOpacity
              onPress={() => {
                showTipsPopup({
                  title: t('page.perpsDetail.PerpsPosition.fundingPayments'),
                  desc: t('page.perpsDetail.PerpsPosition.fundingPaymentsTips'),
                });
              }}>
              <View style={styles.listItemMain}>
                <Text style={styles.label}>
                  {t('page.perpsDetail.PerpsPosition.fundingPayments')}
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
                {Number(positionData?.fundingPayments || 0) >= 0 ? '+' : '-'}$
                {Math.abs(Number(positionData?.fundingPayments || 0))}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <PerpsRiskLevelPopup
        visible={!!showRiskPopup}
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
        pnl={positionData?.pnl}
        pnlPercent={positionData?.pnlPercent}
        marginUsed={positionData?.marginUsed}
        positionSize={positionData?.size}
        direction={positionData?.direction as 'Long' | 'Short'}
        coin={coin}
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
    marginBottom: 12,
    gap: 12,
    flexDirection: 'row',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
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
}));
