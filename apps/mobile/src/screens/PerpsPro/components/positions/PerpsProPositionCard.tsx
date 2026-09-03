import RcIconEdit from '@/assets2024/icons/perps/IconPerpEdit.svg';
import RcManageMargin from '@/assets2024/icons/perps/PerpsProAvailableAdd.svg';
import RcIconSwitchUnit from '@/assets2024/icons/perps/PerpsProPositionUnitSwitch.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import {
  Pressable,
  View,
  type LayoutChangeEvent,
  type TextLayoutEvent,
} from 'react-native';
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
  formatPerpsProVariableDecimal,
} from '../../utils/format';
import { PerpsProDottedUnderlineText } from '../common/PerpsProDottedUnderlineText';
import { PerpsProMarketPair } from '../common/PerpsProMarketPair';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
  getPerpsProSolidSideTagContainerStyle,
  getPerpsProSolidSideTagTextStyle,
  getPerpsProTintedTagContainerStyle,
  getPerpsProTintedTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import {
  resolvePerpsProPositionMetricCollision,
  type PerpsProPositionMetricCollisionMeasurements,
} from './perpsProPositionMetricCollision';

const METRIC_COLUMN_GAP = 8;

type MetricRow = 'position' | 'price';
type MetricMeasurements = Partial<PerpsProPositionMetricCollisionMeasurements>;
type MetricRowHandlers = Readonly<{
  onMiddleTextLayout: (event: TextLayoutEvent) => void;
  onRightLineLayout: (
    line: Readonly<{
      lineCount: number;
      width: number;
    }>,
  ) => void;
  onRowLayout: (event: LayoutChangeEvent) => void;
  onSecondColumnLayout: (event: LayoutChangeEvent) => void;
}>;

const useResponsiveMetricLayout = (measurementKey: string) => {
  const measurementsRef = React.useRef<{
    key: string;
    rows: Record<MetricRow, MetricMeasurements>;
  }>({
    key: measurementKey,
    rows: { position: {}, price: {} },
  });
  const [layoutState, setLayoutState] = React.useState({
    expanded: false,
    key: measurementKey,
  });

  if (measurementsRef.current.key !== measurementKey) {
    measurementsRef.current = {
      key: measurementKey,
      rows: { position: {}, price: {} },
    };
  }

  const updateMeasurement = React.useCallback(
    (key: string, row: MetricRow, patch: MetricMeasurements) => {
      const currentMeasurements = measurementsRef.current;
      if (currentMeasurements.key !== key) {
        return;
      }

      Object.assign(currentMeasurements.rows[row], patch);
      const collisions = (
        Object.keys(currentMeasurements.rows) as MetricRow[]
      ).map(metricRow =>
        resolvePerpsProPositionMetricCollision(
          currentMeasurements.rows[metricRow],
          METRIC_COLUMN_GAP,
        ),
      );
      const nextExpanded = collisions.some(collision => collision === true)
        ? true
        : collisions.every(collision => collision === false)
        ? false
        : null;

      if (nextExpanded == null) {
        return;
      }
      setLayoutState(currentState =>
        currentState.key === key && currentState.expanded === nextExpanded
          ? currentState
          : { expanded: nextExpanded, key },
      );
    },
    [],
  );

  const handlers = React.useMemo(() => {
    const buildRowHandlers = (row: MetricRow): MetricRowHandlers => ({
      onMiddleTextLayout: (event: TextLayoutEvent) => {
        const firstLine = event.nativeEvent.lines[0];
        if (!firstLine) {
          return;
        }
        updateMeasurement(measurementKey, row, {
          middleFirstLineWidth: firstLine.width,
          middleFirstLineX: firstLine.x,
        });
      },
      onRightLineLayout: line => {
        updateMeasurement(measurementKey, row, {
          rightNaturalWidth: line.width,
          rightWrapped: line.lineCount > 1,
        });
      },
      onRowLayout: (event: LayoutChangeEvent) => {
        updateMeasurement(measurementKey, row, {
          rowWidth: event.nativeEvent.layout.width,
        });
      },
      onSecondColumnLayout: (event: LayoutChangeEvent) => {
        updateMeasurement(measurementKey, row, {
          secondColumnX: event.nativeEvent.layout.x,
        });
      },
    });

    return {
      position: buildRowHandlers('position'),
      price: buildRowHandlers('price'),
    };
  }, [measurementKey, updateMeasurement]);

  return {
    expanded: layoutState.key === measurementKey && layoutState.expanded,
    ...handlers,
  };
};

const SIZE_UNIT_HIT_SLOP = {
  bottom: 14,
  left: 4,
  right: 4,
  top: 14,
} as const;

const withOptionalUnit = (label: string, unit: string | null) =>
  unit ? `${label} (${unit})` : label;

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
    const sizeAsset: string | null =
      sizeUnit === 'quote' ? market.quoteAsset : market.displayBase;
    const sizeLabel = withOptionalUnit(
      t('page.perps.pro.positions.size'),
      sizeAsset,
    );
    const marginLabel = withOptionalUnit(
      t('page.perps.pro.positions.margin'),
      market.quoteAsset,
    );
    const marginRatioLabel = t('page.perps.pro.positions.marginRatio');
    const liquidationDistanceLabel = t(
      'page.perps.pro.positions.liquidationDistance',
    );
    const entryLabel = withOptionalUnit(
      t('page.perps.pro.positions.entry'),
      market.quoteAsset,
    );
    const markLabel = withOptionalUnit(
      t('page.perps.pro.positions.mark'),
      market.quoteAsset,
    );
    const liquidationLabel = withOptionalUnit(
      t('page.perps.pro.positions.liquidation'),
      market.quoteAsset,
    );
    const metricMeasurementKey = React.useMemo(
      () =>
        [
          position.marginMode,
          sizeLabel,
          marginLabel,
          position.marginMode === 'cross'
            ? marginRatioLabel
            : liquidationDistanceLabel,
          entryLabel,
          markLabel,
          liquidationLabel,
        ].join('\u0000'),
      [
        entryLabel,
        liquidationDistanceLabel,
        liquidationLabel,
        marginLabel,
        marginRatioLabel,
        markLabel,
        position.marginMode,
        sizeLabel,
      ],
    );
    const metricLayout = useResponsiveMetricLayout(metricMeasurementKey);
    const displaySize =
      sizeUnit === 'quote'
        ? formatPerpsProDecimal(size, 2)
        : formatPerpsProVariableDecimal(size);
    const displayPnl = `${pnl > 0 ? '+' : ''}${formatPerpsProDecimal(
      position.pnl,
      2,
    )}`;
    const signedLiquidationDistance = React.useMemo(
      () =>
        position.marginMode === 'isolated'
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
    const formattedLiquidationPrice = formatPerpsProPrice(
      position.liquidationPrice,
      market.pxDecimals,
    );
    const displayLiquidationPrice =
      formattedLiquidationPrice === '-' ? '--' : formattedLiquidationPrice;
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
        <View
          style={styles.titleRow}
          testID={`perps-pro-position-title-${position.key}`}>
          <View
            style={isLong ? styles.longSide : styles.shortSide}
            testID={`perps-pro-position-side-${position.key}`}>
            <Text style={isLong ? styles.longSideText : styles.shortSideText}>
              {isLong ? 'B' : 'S'}
            </Text>
          </View>
          <PerpsProMarketPair
            metadataReady={market.metadataReady}
            onPress={
              onPressMarket ? () => onPressMarket(position.coin) : undefined
            }
            style={styles.marketButton}
            testID={`perps-pro-position-market-${position.key}`}
            textStyle={styles.coin}
            value={market.displayPair}
          />
          {market.sourceTag ? (
            <View
              style={styles.sourceTag}
              testID={`perps-pro-position-source-${position.key}`}>
              <Text style={styles.sourceText}>{market.sourceTag}</Text>
            </View>
          ) : null}
          <View
            style={styles.modeTag}
            testID={`perps-pro-position-mode-${position.key}`}>
            <Text style={styles.modeText}>
              {position.marginMode === 'cross'
                ? t('page.perps.pro.positions.cross')
                : t('page.perps.pro.positions.isolated')}
            </Text>
          </View>
          <View
            style={isLong ? styles.longTag : styles.shortTag}
            testID={`perps-pro-position-direction-${position.key}`}>
            <Text style={isLong ? styles.longText : styles.shortText}>
              {isLong
                ? t('page.perps.pro.positions.long')
                : t('page.perps.pro.positions.short')}{' '}
              {position.leverage}x
            </Text>
          </View>
        </View>

        <View style={styles.pnlRow}>
          <View style={styles.pairedMetric}>
            <PerpsProDottedUnderlineText
              accessibilityLabel={t('page.perps.pro.positions.pnl')}
              onPress={() => openFieldExplanation('pnl')}
              style={styles.label}>
              {withOptionalUnit(
                t('page.perps.pro.positions.pnl'),
                market.quoteAsset,
              )}
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

        <View
          onLayout={metricLayout.position.onRowLayout}
          style={styles.threeColumns}
          testID={`perps-pro-position-metrics-${position.key}`}>
          <View
            style={[
              styles.firstColumn,
              metricLayout.expanded ? styles.expandedMetricColumn : null,
            ]}>
            <Pressable
              accessibilityLabel={t('page.perps.pro.positions.switchSizeUnit')}
              accessibilityRole="button"
              accessibilityValue={{ text: sizeAsset || undefined }}
              hitSlop={SIZE_UNIT_HIT_SLOP}
              onPress={toggleSizeUnit}
              style={styles.labelWithIcon}
              testID={`perps-pro-position-unit-${position.key}`}>
              <Text style={[styles.label, styles.shrinkableLabel]}>
                {sizeLabel}
              </Text>
              <View pointerEvents="none" style={styles.unitSwitch}>
                <RcIconSwitchUnit
                  color={colors2024['neutral-secondary']}
                  height={16}
                  testID={`perps-pro-position-unit-icon-${position.key}`}
                  width={16}
                />
              </View>
            </Pressable>
            <Text style={styles.value}>{displaySize}</Text>
          </View>
          <View
            onLayout={metricLayout.position.onSecondColumnLayout}
            style={[
              styles.secondColumn,
              metricLayout.expanded ? styles.expandedMetricColumn : null,
            ]}
            testID={`perps-pro-position-middle-metric-${position.key}`}>
            <Text
              onTextLayout={metricLayout.position.onMiddleTextLayout}
              style={styles.label}>
              {marginLabel}
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
          <View
            style={[
              styles.thirdColumn,
              metricLayout.expanded ? styles.expandedMetricColumn : null,
            ]}>
            {position.marginMode === 'cross' ? (
              <>
                <PerpsProDottedUnderlineText
                  accessibilityLabel={marginRatioLabel}
                  containerStyle={
                    metricLayout.expanded
                      ? styles.expandedRightDottedLabel
                      : styles.rightDottedLabel
                  }
                  multiline
                  onFirstLineLayout={metricLayout.position.onRightLineLayout}
                  onPress={() => openFieldExplanation('marginRatio')}
                  style={[
                    styles.label,
                    metricLayout.expanded ? styles.expandedRightLabel : null,
                  ]}>
                  {marginRatioLabel}
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
            ) : metricLayout.expanded ? (
              <>
                <PerpsProDottedUnderlineText
                  accessibilityLabel={liquidationDistanceLabel}
                  containerStyle={styles.expandedRightDottedLabel}
                  multiline
                  onPress={() => openFieldExplanation('liquidationDistance')}
                  style={[styles.label, styles.expandedRightLabel]}>
                  {liquidationDistanceLabel}
                </PerpsProDottedUnderlineText>
                <View style={styles.metricValueSpacer} />
              </>
            ) : (
              <View style={styles.metricLabelSpacer} />
            )}
          </View>
          {position.marginMode === 'isolated' ? (
            <>
              {metricLayout.expanded ? null : (
                <View
                  pointerEvents="box-none"
                  style={styles.rightMetricLabelOverlay}
                  testID={`perps-pro-position-liquidation-distance-label-${position.key}`}>
                  <PerpsProDottedUnderlineText
                    accessibilityLabel={liquidationDistanceLabel}
                    allowNaturalWidth
                    containerStyle={styles.rightDottedLabel}
                    onFirstLineLayout={metricLayout.position.onRightLineLayout}
                    onPress={() => openFieldExplanation('liquidationDistance')}
                    style={styles.label}>
                    {liquidationDistanceLabel}
                  </PerpsProDottedUnderlineText>
                </View>
              )}
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
            </>
          ) : null}
        </View>

        <View
          onLayout={metricLayout.price.onRowLayout}
          style={styles.threeColumns}
          testID={`perps-pro-position-price-metrics-${position.key}`}>
          <View
            style={[
              styles.firstColumn,
              metricLayout.expanded ? styles.expandedMetricColumn : null,
            ]}>
            <Text style={styles.label}>{entryLabel}</Text>
            <Text style={styles.value}>
              {formatPerpsProPrice(position.entryPrice, market.pxDecimals)}
            </Text>
          </View>
          <View
            onLayout={metricLayout.price.onSecondColumnLayout}
            style={[
              styles.secondColumn,
              metricLayout.expanded ? styles.expandedMetricColumn : null,
            ]}
            testID={`perps-pro-position-middle-price-${position.key}`}>
            <Text
              onTextLayout={metricLayout.price.onMiddleTextLayout}
              style={styles.label}>
              {markLabel}
            </Text>
            <Text style={styles.value}>
              {formatPerpsProPrice(market.markPrice, market.pxDecimals)}
            </Text>
          </View>
          <View
            style={[
              styles.thirdColumn,
              metricLayout.expanded ? styles.expandedMetricColumn : null,
            ]}>
            {metricLayout.expanded ? (
              <PerpsProDottedUnderlineText
                accessibilityLabel={t('page.perps.pro.positions.liquidation')}
                containerStyle={styles.expandedRightDottedLabel}
                multiline
                onPress={() => openFieldExplanation('liquidationPrice')}
                style={[styles.label, styles.expandedRightLabel]}>
                {liquidationLabel}
              </PerpsProDottedUnderlineText>
            ) : (
              <View style={styles.metricLabelSpacer} />
            )}
            <Text style={styles.value}>{displayLiquidationPrice}</Text>
          </View>
          {metricLayout.expanded ? null : (
            <View
              pointerEvents="box-none"
              style={styles.rightMetricLabelOverlay}
              testID={`perps-pro-position-liquidation-label-${position.key}`}>
              <PerpsProDottedUnderlineText
                accessibilityLabel={t('page.perps.pro.positions.liquidation')}
                allowNaturalWidth
                containerStyle={styles.rightDottedLabel}
                onFirstLineLayout={metricLayout.price.onRightLineLayout}
                onPress={() => openFieldExplanation('liquidationPrice')}
                style={styles.label}>
                {liquidationLabel}
              </PerpsProDottedUnderlineText>
            </View>
          )}
        </View>

        {tpSlSummary.mode !== 'none' ? (
          <Pressable
            accessibilityLabel={t('page.perps.pro.positions.tpsl')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !onEditTpSl }}
            disabled={!onEditTpSl}
            onPress={() => onEditTpSl?.(position, editDefaultTab)}
            style={styles.tpslRow}
            testID={`perps-pro-position-tpsl-edit-${position.key}`}>
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
            <View pointerEvents="none" style={styles.editIcon}>
              <RcIconEdit
                color={colors2024['neutral-secondary']}
                height={16}
                width={16}
              />
            </View>
          </Pressable>
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
    borderBottomColor: colors2024['neutral-bg-5'],
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
    ...getPerpsProSolidSideTagContainerStyle(colors2024, 'positive'),
  },
  shortSide: {
    ...getPerpsProSolidSideTagContainerStyle(colors2024, 'negative'),
  },
  longSideText: getPerpsProSolidSideTagTextStyle(colors2024),
  shortSideText: getPerpsProSolidSideTagTextStyle(colors2024),
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
    ...getPerpsProTintedTagContainerStyle(colors2024, 'positive'),
    justifyContent: 'center',
  },
  shortTag: {
    ...getPerpsProTintedTagContainerStyle(colors2024, 'negative'),
    justifyContent: 'center',
  },
  longText: getPerpsProTintedTagTextStyle(colors2024, 'positive'),
  shortText: getPerpsProTintedTagTextStyle(colors2024, 'negative'),
  modeTag: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    justifyContent: 'center',
  },
  modeText: getPerpsProMetadataTagTextStyle(colors2024),
  sourceTag: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    justifyContent: 'center',
  },
  sourceText: getPerpsProMetadataTagTextStyle(colors2024),
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
    gap: METRIC_COLUMN_GAP,
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
  expandedMetricColumn: {
    justifyContent: 'space-between',
  },
  metricLabelSpacer: {
    height: 16,
  },
  metricValueSpacer: {
    height: 18,
  },
  rightMetricLabelOverlay: {
    alignItems: 'flex-end',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  labelWithIcon: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    minWidth: 0,
  },
  shrinkableLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  unitSwitch: {
    alignItems: 'center',
    flexShrink: 0,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  expandedRightDottedLabel: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  expandedRightLabel: {
    textAlign: 'right',
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
    gap: 12,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
    minHeight: 26,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 18,
    maxWidth: '100%',
    textAlign: 'center',
  },
  disabledActionText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    lineHeight: 18,
    maxWidth: '100%',
    textAlign: 'center',
  },
}));
