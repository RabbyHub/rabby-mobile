import RcIconEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import RcManageMargin from '@/assets2024/icons/perps/PerpsProAvailableAdd.svg';
import RcIconSwitchUnit from '@/assets/icons/swap/switch-cc.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  calculateSignedLiquidationDistance,
  getPerpsPositionDisplaySize,
  type PerpsPositionViewModel,
} from '../../model/position';
import {
  buildPositionTpSlSummary,
  resolvePositionTpSlEditTab,
} from '../../model/positionTpSl';
import { usePerpsProPositionMark } from '../../scene/usePerpsProPositionMark';
import { usePerpsProPositionSizeUnit } from '../../scene/positionSizeUnitSession';
import {
  formatPerpsProDecimal,
  formatPerpsProPercent,
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';

const SIZE_UNIT_HIT_SLOP = {
  bottom: 14,
  left: 4,
  right: 4,
  top: 14,
} as const;

const PositionAction: React.FC<{
  label: string;
  onPress?: () => void;
  testID?: string;
}> = ({ label, onPress, testID }) => {
  const { styles } = useTheme2024({ getStyle });
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.action,
        pressed && !disabled ? styles.actionPressed : null,
      ]}>
      <Text style={disabled ? styles.disabledActionText : styles.actionText}>
        {label}
      </Text>
    </Pressable>
  );
};

export const PerpsProPositionCard: React.FC<{
  accountIdentity: string;
  onClose?: (position: PerpsPositionViewModel) => void;
  onEditLeverage?: (position: PerpsPositionViewModel) => void;
  onEditTpSl?: (
    position: PerpsPositionViewModel,
    tab: 'partial' | 'position',
  ) => void;
  onManageMargin?: (position: PerpsPositionViewModel) => void;
  onPressMarket?: (coin: string) => void;
  position: PerpsPositionViewModel;
}> = React.memo(
  ({
    accountIdentity,
    onClose,
    onEditLeverage,
    onEditTpSl,
    onManageMargin,
    onPressMarket,
    position,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    const openFieldExplanation = usePerpsProFieldExplanation();
    const market = usePerpsProPositionMark(position.coin);
    const { toggle: toggleSizeUnit, unit: sizeUnit } =
      usePerpsProPositionSizeUnit(accountIdentity, position.key);
    const isLong = position.direction === 'long';
    const pnl = Number(position.pnl);
    const roi = Number(position.roiRatio);
    const size = getPerpsPositionDisplaySize(position, sizeUnit);
    const sizeAsset =
      sizeUnit === 'quote' ? market.quoteAsset : market.displayBase;
    const displaySize =
      sizeUnit === 'quote'
        ? formatPerpsProDecimal(size, 2)
        : formatPerpsProDecimal(size, 4);
    const displayPnl = `${pnl > 0 ? '+' : ''}${formatPerpsProDecimal(
      position.pnl,
      2,
    )}`;
    const signedLiquidationDistance = React.useMemo(
      () =>
        position.marginMode === 'cross'
          ? calculateSignedLiquidationDistance({
              liquidationPrice: position.liquidationPrice,
              markPrice: market.markPrice,
            })
          : null,
      [market.markPrice, position.liquidationPrice, position.marginMode],
    );
    const displayLiquidationDistance = signedLiquidationDistance
      ? `${formatPerpsProPercent(
          Number(signedLiquidationDistance.ratio),
          2,
        )}(${formatPerpsProSignedDecimal(
          signedLiquidationDistance.priceGap,
          market.pxDecimals,
        )})`
      : '--';
    const pnlStyle =
      pnl > 0
        ? styles.positiveValue
        : pnl < 0
        ? styles.negativeValue
        : styles.emphasizedValue;
    const roiStyle =
      roi > 0
        ? styles.positiveValue
        : roi < 0
        ? styles.negativeValue
        : styles.emphasizedValue;
    const tpSlSummary = React.useMemo(
      () => buildPositionTpSlSummary(position.tpslOrders, market.markPrice),
      [market.markPrice, position.tpslOrders],
    );
    const displayPositionOrders =
      tpSlSummary.mode === 'position' || tpSlSummary.mode === 'mixed';
    const takeProfitOrder = displayPositionOrders
      ? tpSlSummary.takeProfit.nearestPositionOrder
      : tpSlSummary.takeProfit.nearestPartialOrder;
    const stopLossOrder = displayPositionOrders
      ? tpSlSummary.stopLoss.nearestPositionOrder
      : tpSlSummary.stopLoss.nearestPartialOrder;
    const editDefaultTab = resolvePositionTpSlEditTab(position.tpslOrders);

    return (
      <View style={styles.row} testID={`perps-pro-position-${position.key}`}>
        <View style={styles.titleRow}>
          <View style={isLong ? styles.longSide : styles.shortSide}>
            <Text style={isLong ? styles.longSideText : styles.shortSideText}>
              {isLong ? 'B' : 'S'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={market.displayPair}
            accessibilityRole="button"
            disabled={!onPressMarket}
            onPress={() => onPressMarket?.(position.coin)}
            style={styles.marketButton}
            testID={`perps-pro-position-market-${position.key}`}>
            <Text numberOfLines={1} style={styles.coin}>
              {market.displayPair}
            </Text>
          </Pressable>
          <View style={isLong ? styles.longTag : styles.shortTag}>
            <Text style={isLong ? styles.longText : styles.shortText}>
              {isLong
                ? t('page.perps.pro.positions.long')
                : t('page.perps.pro.positions.short')}{' '}
              {position.leverage}x
            </Text>
          </View>
          <View style={styles.modeTag}>
            <Text style={styles.modeText}>
              {position.marginMode === 'cross'
                ? t('page.perps.pro.positions.cross')
                : t('page.perps.pro.positions.isolated')}
            </Text>
          </View>
          {market.sourceTag ? (
            <View style={styles.sourceTag}>
              <Text style={styles.sourceText}>
                {market.sourceTag.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.pnlRow}>
          <View style={styles.pairedMetric}>
            <PerpsProDottedUnderlineText
              accessibilityLabel={t('page.perps.pro.positions.pnl')}
              onPress={() => openFieldExplanation('pnl')}
              style={styles.label}>
              {t('page.perps.pro.positions.pnl')} ({market.quoteAsset})
            </PerpsProDottedUnderlineText>
            <Text style={pnlStyle}>{displayPnl}</Text>
          </View>
          <View style={styles.pairedMetricRight}>
            <PerpsProDottedUnderlineText
              accessibilityLabel={t('page.perps.pro.positions.roi')}
              containerStyle={styles.rightDottedLabel}
              onPress={() => openFieldExplanation('roi')}
              style={styles.label}>
              {t('page.perps.pro.positions.roi')}
            </PerpsProDottedUnderlineText>
            <Text style={roiStyle}>{formatPerpsProPercent(roi, 2, true)}</Text>
          </View>
        </View>

        <View style={styles.threeColumns}>
          <View style={styles.firstColumn}>
            <Pressable
              accessibilityLabel={t('page.perps.pro.positions.switchSizeUnit')}
              accessibilityRole="button"
              accessibilityValue={{ text: sizeAsset }}
              hitSlop={SIZE_UNIT_HIT_SLOP}
              onPress={toggleSizeUnit}
              style={styles.labelWithIcon}
              testID={`perps-pro-position-unit-${position.key}`}>
              <Text style={styles.label}>
                {t('page.perps.pro.positions.size')} ({sizeAsset})
              </Text>
              <View pointerEvents="none" style={styles.unitSwitch}>
                <RcIconSwitchUnit
                  color={colors2024['neutral-secondary']}
                  height={16}
                  width={16}
                />
              </View>
            </Pressable>
            <Text style={styles.value}>{displaySize}</Text>
          </View>
          <View style={styles.secondColumn}>
            <Text style={styles.label}>
              {t('page.perps.pro.positions.margin')} ({market.quoteAsset})
            </Text>
            <View style={styles.marginValueRow}>
              <Text style={styles.marginValue}>
                {formatPerpsProDecimal(position.margin, 2)}
              </Text>
              {position.marginMode === 'isolated' && onManageMargin ? (
                <Pressable
                  accessibilityLabel={t(
                    'page.perps.pro.positions.manageMargin',
                  )}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => onManageMargin(position)}
                  style={styles.marginButton}
                  testID={`perps-pro-position-manage-margin-${position.key}`}>
                  <RcManageMargin
                    color={colors2024['neutral-body']}
                    height={16}
                    width={16}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.thirdColumn}>
            {position.marginMode === 'isolated' ? (
              <>
                <PerpsProDottedUnderlineText
                  accessibilityLabel={t('page.perps.pro.positions.marginRatio')}
                  containerStyle={styles.rightDottedLabel}
                  onPress={() => openFieldExplanation('marginRatio')}
                  style={styles.label}>
                  {t('page.perps.pro.positions.marginRatio')}
                </PerpsProDottedUnderlineText>
                <Text style={styles.value}>
                  {formatPerpsProPercent(
                    position.marginRatio == null
                      ? null
                      : Number(position.marginRatio),
                    2,
                    false,
                  )}
                </Text>
              </>
            ) : (
              <>
                <PerpsProDottedUnderlineText
                  accessibilityLabel={t(
                    'page.perps.pro.positions.liquidationDistance',
                  )}
                  containerStyle={styles.rightDottedLabel}
                  onPress={() => openFieldExplanation('liquidationDistance')}
                  style={styles.label}>
                  {t('page.perps.pro.positions.liquidationDistance')}
                </PerpsProDottedUnderlineText>
              </>
            )}
          </View>
          {position.marginMode === 'cross' ? (
            <View
              pointerEvents="none"
              style={styles.liquidationDistanceValueOverlay}
              testID={`perps-pro-position-liquidation-distance-${position.key}`}>
              <Text
                numberOfLines={1}
                style={[styles.value, styles.liquidationDistanceValue]}>
                {displayLiquidationDistance}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.threeColumns}>
          <View style={styles.firstColumn}>
            <Text style={styles.label}>
              {t('page.perps.pro.positions.entry')} ({market.quoteAsset})
            </Text>
            <Text style={styles.value}>
              {formatPerpsProPrice(position.entryPrice, market.pxDecimals)}
            </Text>
          </View>
          <View style={styles.secondColumn}>
            <Text style={styles.label}>
              {t('page.perps.pro.positions.mark')} ({market.quoteAsset})
            </Text>
            <Text style={styles.value}>
              {formatPerpsProPrice(market.markPrice, market.pxDecimals)}
            </Text>
          </View>
          <View style={styles.thirdColumn}>
            <PerpsProDottedUnderlineText
              accessibilityLabel={t('page.perps.pro.positions.liquidation')}
              containerStyle={styles.rightDottedLabel}
              onPress={() => openFieldExplanation('liquidationPrice')}
              style={styles.label}>
              {t('page.perps.pro.positions.liquidation')} ({market.quoteAsset})
            </PerpsProDottedUnderlineText>
            <Text style={styles.value}>
              {formatPerpsProPrice(
                position.liquidationPrice,
                market.pxDecimals,
              )}
            </Text>
          </View>
        </View>

        {tpSlSummary.mode !== 'none' ? (
          <View
            style={styles.tpslRow}
            testID={`perps-pro-position-tpsl-${position.key}`}>
            <Text style={styles.tpslTitle}>
              {tpSlSummary.mode === 'partial'
                ? `${t('page.perps.pro.positions.tpsl')}(${
                    tpSlSummary.partialCount
                  })`
                : t('page.perps.pro.positions.positionTpsl')}
            </Text>
            <View
              style={styles.tpslValues}
              testID={`perps-pro-position-tpsl-values-${position.key}`}>
              <Text style={styles.takeProfit}>
                {takeProfitOrder
                  ? formatPerpsProPrice(
                      takeProfitOrder.triggerPrice,
                      market.pxDecimals,
                    )
                  : '--'}
              </Text>
              <Text style={styles.separator}> / </Text>
              <Text style={styles.stopLoss}>
                {stopLossOrder
                  ? formatPerpsProPrice(
                      stopLossOrder.triggerPrice,
                      market.pxDecimals,
                    )
                  : '--'}
              </Text>
              {tpSlSummary.mode === 'mixed' ? (
                <Text style={styles.partialTpSlCount}>
                  {t('page.perps.pro.positions.tpsl')}(
                  {tpSlSummary.partialCount})
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel={t('page.perps.pro.positions.tpsl')}
              accessibilityRole="button"
              accessibilityState={{ disabled: !onEditTpSl }}
              disabled={!onEditTpSl}
              onPress={() => onEditTpSl?.(position, editDefaultTab)}
              style={styles.editIcon}
              testID={`perps-pro-position-tpsl-edit-${position.key}`}>
              <RcIconEdit
                color={colors2024['neutral-secondary']}
                height={16}
                width={16}
              />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PositionAction
            label={t('page.perps.pro.positions.leverage')}
            onPress={
              onEditLeverage ? () => onEditLeverage(position) : undefined
            }
          />
          <PositionAction
            label={t('page.perps.pro.positions.tpsl')}
            onPress={
              onEditTpSl ? () => onEditTpSl(position, 'partial') : undefined
            }
            testID={`perps-pro-position-tpsl-action-${position.key}`}
          />
          <PositionAction
            label={t('page.perps.pro.positions.close')}
            onPress={onClose ? () => onClose(position) : undefined}
          />
        </View>
      </View>
    );
  },
);

PerpsProPositionCard.displayName = 'PerpsProPositionCard';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  row: {
    borderBottomColor: colors2024['neutral-line'],
    borderBottomWidth: 1,
    gap: 12,
    marginHorizontal: 15,
    paddingVertical: 8,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  longSide: {
    alignItems: 'center',
    backgroundColor: colors2024['green-default'],
    borderRadius: 2,
    height: 12,
    justifyContent: 'center',
    width: 12,
  },
  shortSide: {
    alignItems: 'center',
    backgroundColor: colors2024['red-default'],
    borderRadius: 2,
    height: 12,
    justifyContent: 'center',
    width: 12,
  },
  longSideText: {
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
  shortSideText: {
    color: colors2024['neutral-bg-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
  coin: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    maxWidth: 140,
  },
  marketButton: { flexShrink: 1, maxWidth: 140 },
  longTag: {
    backgroundColor: colors2024['green-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  shortTag: {
    backgroundColor: colors2024['red-light-1'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  longText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  shortText: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  modeTag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  modeText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  sourceTag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  sourceText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  pnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pairedMetric: {
    flex: 1,
  },
  pairedMetricRight: {
    alignItems: 'flex-end',
    flex: 1,
  },
  rightDottedLabel: {
    alignSelf: 'flex-end',
  },
  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  emphasizedValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 2,
  },
  positiveValue: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 2,
  },
  negativeValue: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 2,
  },
  threeColumns: {
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
  },
  firstColumn: {
    flexBasis: 0,
    flexGrow: 128,
    minWidth: 0,
  },
  secondColumn: {
    flexBasis: 0,
    flexGrow: 116,
    minWidth: 0,
  },
  thirdColumn: {
    alignItems: 'flex-end',
    flexBasis: 0,
    flexGrow: 103,
    minWidth: 0,
  },
  labelWithIcon: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  unitSwitch: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  value: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 2,
  },
  marginValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  marginValue: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  marginButton: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  liquidationDistanceValueOverlay: {
    alignItems: 'flex-end',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  liquidationDistanceValue: {
    marginTop: 0,
  },
  tpslRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tpslTitle: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  tpslValues: {
    flexDirection: 'row',
    flexShrink: 1,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  takeProfit: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  stopLoss: {
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  partialTpSlCount: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginLeft: 8,
  },
  separator: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
  },
  editIcon: {
    alignItems: 'center',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  disabledActionText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
