import RcIconEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
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
import { usePerpsProPositionMark } from '../../scene/usePerpsProPositionMark';
import { usePerpsProPositionSizeUnit } from '../../scene/positionSizeUnitSession';
import {
  formatPerpsProDecimal,
  formatPerpsProPercent,
  formatPerpsProPrice,
  formatPerpsProSignedDecimal,
} from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';

const SIZE_UNIT_HIT_SLOP = {
  bottom: 14,
  left: 4,
  right: 4,
  top: 14,
} as const;

const PositionAction: React.FC<{
  label: string;
  onPress?: () => void;
}> = ({ label, onPress }) => {
  const { styles } = useTheme2024({ getStyle });
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
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
  position: PerpsPositionViewModel;
}> = React.memo(({ accountIdentity, onClose, onEditLeverage, position }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
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
  const takeProfitOrders = position.tpslOrders.filter(
    order => order.kind === 'takeProfit',
  );
  const stopLossOrders = position.tpslOrders.filter(
    order => order.kind === 'stopLoss',
  );
  const unknownTriggerOrders = position.tpslOrders.filter(
    order => order.kind === 'unknown',
  );
  const formatTriggerPrices = (orders: typeof position.tpslOrders): string =>
    orders
      .map(order => formatPerpsProPrice(order.triggerPrice, market.pxDecimals))
      .join(', ');

  return (
    <View style={styles.row} testID={`perps-pro-position-${position.key}`}>
      <View style={styles.titleRow}>
        <View style={isLong ? styles.longSide : styles.shortSide}>
          <Text style={isLong ? styles.longSideText : styles.shortSideText}>
            {isLong ? 'B' : 'S'}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.coin}>
          {market.displayPair}
        </Text>
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
          <PerpsProDottedUnderlineText style={styles.label}>
            {t('page.perps.pro.positions.pnl')} ({market.quoteAsset})
          </PerpsProDottedUnderlineText>
          <Text style={pnlStyle}>{displayPnl}</Text>
        </View>
        <View style={styles.pairedMetricRight}>
          <PerpsProDottedUnderlineText
            containerStyle={styles.rightDottedLabel}
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
          <Text style={styles.value}>
            {formatPerpsProDecimal(position.margin, 2)}
          </Text>
        </View>
        <View style={styles.thirdColumn}>
          {position.marginMode === 'isolated' ? (
            <>
              <PerpsProDottedUnderlineText
                containerStyle={styles.rightDottedLabel}
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
                containerStyle={styles.rightDottedLabel}
                style={styles.label}>
                {t('page.perps.pro.positions.liquidationDistance')}
              </PerpsProDottedUnderlineText>
              <Text style={styles.value}>{displayLiquidationDistance}</Text>
            </>
          )}
        </View>
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
            containerStyle={styles.rightDottedLabel}
            style={styles.label}>
            {t('page.perps.pro.positions.liquidation')} ({market.quoteAsset})
          </PerpsProDottedUnderlineText>
          <Text style={styles.value}>
            {formatPerpsProPrice(position.liquidationPrice, market.pxDecimals)}
          </Text>
        </View>
      </View>

      {position.tpslOrders.length > 0 ? (
        <View
          style={styles.tpslRow}
          testID={`perps-pro-position-tpsl-${position.key}`}>
          <Text style={styles.tpslTitle}>
            {t('page.perps.pro.positions.tpsl')} ({position.tpslOrders.length})
          </Text>
          <View
            style={styles.tpslValues}
            testID={`perps-pro-position-tpsl-values-${position.key}`}>
            <Text style={styles.takeProfit}>
              {takeProfitOrders.length > 0
                ? formatTriggerPrices(takeProfitOrders)
                : '--'}
            </Text>
            <Text style={styles.separator}> / </Text>
            <Text style={styles.stopLoss}>
              {stopLossOrders.length > 0
                ? formatTriggerPrices(stopLossOrders)
                : '--'}
            </Text>
            {unknownTriggerOrders.length > 0 ? (
              <>
                <Text style={styles.separator}> / </Text>
                <Text style={styles.unknownTrigger}>
                  {t('page.perps.pro.positions.triggerShort')}{' '}
                  {formatTriggerPrices(unknownTriggerOrders)}
                </Text>
              </>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel={t('page.perps.pro.positions.tpsl')}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            disabled
            style={styles.editIcon}>
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
          onPress={onEditLeverage ? () => onEditLeverage(position) : undefined}
        />
        <PositionAction label={t('page.perps.pro.positions.tpsl')} />
        <PositionAction
          label={t('page.perps.pro.positions.close')}
          onPress={onClose ? () => onClose(position) : undefined}
        />
      </View>
    </View>
  );
});

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
  unknownTrigger: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
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
