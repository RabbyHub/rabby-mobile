import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import RcIconEdit from '@/assets2024/icons/perps/PerpsProEdit.svg';
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
  type StyleProp,
  type TextLayoutEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';

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
import { getPerpsProInfoCardStyle } from '../common/perpsProListVisual';
import { usePerpsProFieldExplanation } from '../common/PerpsProFieldExplanationContext';
import { resolvePerpsProFittedFontSize } from '../common/perpsProFitFontSize';
import { PerpsProTextWidthProbe } from '../common/PerpsProTextWidthProbe';
import {
  resolvePerpsProPositionMetricCollision,
  type PerpsProPositionMetricCollisionMeasurements,
} from './perpsProPositionMetricCollision';

const METRIC_COLUMN_GAP = 8;
const METRIC_VALUE_FONT_SIZE = 14;
const METRIC_VALUE_MIN_FONT_SIZE = 10;
const MARGIN_BUTTON_SIZE = 16;
const MARGIN_VALUE_ROW_GAP = 4;

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
  // The expanded layout changes the column width, so re-measuring text while
  // expanded feeds a different geometry back into the same collision check.
  // On Fabric that oscillates between the compact and expanded layouts (the
  // label/underline visibly flicker left-right). Keep the text measurements
  // that produced the decision and only re-evaluate on layout/row changes.
  const expandedRef = React.useRef(layoutState.expanded);
  expandedRef.current =
    layoutState.key === measurementKey ? layoutState.expanded : false;

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
      const isTextMeasurement =
        'middleFirstLineWidth' in patch ||
        'middleFirstLineX' in patch ||
        'rightNaturalWidth' in patch ||
        'rightWrapped' in patch;
      if (expandedRef.current && isTextMeasurement) {
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

/**
 * Single-line metric value that shrinks to its container (Figma 87900:107734).
 * The container stretches to the metric column, so its width never depends on
 * the fitted text; `reservedWidth` keeps room for siblings sharing the space.
 * Below the minimum size the value is capped so it never overlaps them.
 */
const FittedMetricValue: React.FC<
  React.PropsWithChildren<{
    containerStyle?: StyleProp<ViewStyle>;
    onValueWidth?: (width: number) => void;
    reservedWidth?: number;
    textStyle: StyleProp<TextStyle>;
    value: string;
  }>
> = ({
  children,
  containerStyle,
  onValueWidth,
  reservedWidth = 0,
  textStyle,
  value,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [measured, setMeasured] = React.useState({ text: '', width: 0 });
  const availableWidth = containerWidth - reservedWidth;
  const fontSize = resolvePerpsProFittedFontSize({
    availableWidth,
    baseFontSize: METRIC_VALUE_FONT_SIZE,
    minFontSize: METRIC_VALUE_MIN_FONT_SIZE,
    naturalWidth: measured.text === value ? measured.width : 0,
  });
  return (
    <View
      onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}
      style={[styles.fittedValueContainer, containerStyle]}>
      <PerpsProTextWidthProbe
        onWidth={width =>
          setMeasured(current =>
            current.text === value && current.width === width
              ? current
              : { text: value, width },
          )
        }
        style={textStyle}
        text={value}
      />
      <Text
        numberOfLines={1}
        onLayout={
          onValueWidth
            ? event => onValueWidth(event.nativeEvent.layout.width)
            : undefined
        }
        style={[
          textStyle,
          fontSize === METRIC_VALUE_FONT_SIZE ? null : { fontSize },
          reservedWidth > 0 && availableWidth > 0
            ? { maxWidth: availableWidth }
            : null,
        ]}>
        {value}
      </Text>
      {children}
    </View>
  );
};

type MarginValueGeometry = Readonly<{ columnX: number; valueWidth: number }>;
type LiquidationDistanceValueHandle = {
  update: (geometry: MarginValueGeometry) => void;
};

/**
 * The Isolated Liq. Distance value spans the row so it can borrow the middle
 * column's free space, but stops one column gap after the Margin value and
 * its button. Margin geometry is pushed here so measuring it never re-renders
 * the whole card.
 */
const LiquidationDistanceValue = React.forwardRef<
  LiquidationDistanceValueHandle,
  {
    showManageMargin: boolean;
    textStyle: StyleProp<TextStyle>;
    value: string;
  }
>(({ showManageMargin, textStyle, value }, ref) => {
  const { styles } = useTheme2024({ getStyle });
  const [geometry, setGeometry] = React.useState<MarginValueGeometry>({
    columnX: 0,
    valueWidth: 0,
  });
  React.useImperativeHandle(
    ref,
    () => ({
      update: next =>
        setGeometry(current =>
          current.columnX === next.columnX &&
          current.valueWidth === next.valueWidth
            ? current
            : next,
        ),
    }),
    [],
  );
  const reservedWidth =
    geometry.valueWidth > 0
      ? geometry.columnX +
        geometry.valueWidth +
        (showManageMargin ? MARGIN_VALUE_ROW_GAP + MARGIN_BUTTON_SIZE : 0) +
        METRIC_COLUMN_GAP
      : 0;
  return (
    <FittedMetricValue
      containerStyle={styles.rightFittedValue}
      reservedWidth={reservedWidth}
      textStyle={textStyle}
      value={value}
    />
  );
});
LiquidationDistanceValue.displayName = 'LiquidationDistanceValue';

const PositionAction: React.FC<{
  label: string;
  onPress?: () => void;
  testID?: string;
}> = ({ label, onPress, testID }) => {
  const { styles } = useTheme2024({ getStyle });
  const disabled = !onPress;
  return (
    <GesturePressable
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
    </GesturePressable>
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
    const showManageMargin =
      position.marginMode === 'isolated' && !!onManageMargin;
    const marginGeometryRef = React.useRef<MarginValueGeometry>({
      columnX: 0,
      valueWidth: 0,
    });
    const liquidationDistanceRef =
      React.useRef<LiquidationDistanceValueHandle | null>(null);
    const updateMarginGeometry = React.useCallback(
      (patch: Partial<MarginValueGeometry>) => {
        marginGeometryRef.current = { ...marginGeometryRef.current, ...patch };
        liquidationDistanceRef.current?.update(marginGeometryRef.current);
      },
      [],
    );
    const attachLiquidationDistance = React.useCallback(
      (handle: LiquidationDistanceValueHandle | null) => {
        liquidationDistanceRef.current = handle;
        handle?.update(marginGeometryRef.current);
      },
      [],
    );
    const updateMarginValueWidth = React.useCallback(
      (valueWidth: number) => updateMarginGeometry({ valueWidth }),
      [updateMarginGeometry],
    );
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

        <View style={styles.metrics}>
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
              <Text style={roiStyle}>
                {formatPerpsProPercent(roi, 2, true)}
              </Text>
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
                accessibilityLabel={t(
                  'page.perps.pro.positions.switchSizeUnit',
                )}
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
              <FittedMetricValue textStyle={styles.value} value={displaySize} />
            </View>
            <View
              onLayout={event => {
                metricLayout.position.onSecondColumnLayout(event);
                updateMarginGeometry({ columnX: event.nativeEvent.layout.x });
              }}
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
              <FittedMetricValue
                containerStyle={styles.marginValueRow}
                onValueWidth={updateMarginValueWidth}
                reservedWidth={
                  showManageMargin
                    ? MARGIN_BUTTON_SIZE + MARGIN_VALUE_ROW_GAP
                    : 0
                }
                textStyle={styles.marginValue}
                value={formatPerpsProDecimal(position.margin, 2)}>
                {showManageMargin ? (
                  <Pressable
                    accessibilityLabel={t(
                      'page.perps.pro.positions.manageMargin',
                    )}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onManageMargin?.(position)}
                    style={styles.marginButton}
                    testID={`perps-pro-position-manage-margin-${position.key}`}>
                    <RcManageMargin
                      color={colors2024['neutral-body']}
                      height={16}
                      width={16}
                    />
                  </Pressable>
                ) : null}
              </FittedMetricValue>
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
                  <FittedMetricValue
                    containerStyle={styles.rightFittedValue}
                    textStyle={styles.value}
                    value={formatPerpsProPercent(
                      position.marginRatio == null
                        ? null
                        : Number(position.marginRatio),
                      2,
                      false,
                    )}
                  />
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
                      onFirstLineLayout={
                        metricLayout.position.onRightLineLayout
                      }
                      onPress={() =>
                        openFieldExplanation('liquidationDistance')
                      }
                      style={styles.label}>
                      {liquidationDistanceLabel}
                    </PerpsProDottedUnderlineText>
                  </View>
                )}
                <View
                  pointerEvents="none"
                  style={styles.liquidationDistanceValueOverlay}
                  testID={`perps-pro-position-liquidation-distance-${position.key}`}>
                  <LiquidationDistanceValue
                    ref={attachLiquidationDistance}
                    showManageMargin={showManageMargin}
                    textStyle={[styles.value, styles.liquidationDistanceValue]}
                    value={displayLiquidationDistance}
                  />
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
              <FittedMetricValue
                textStyle={styles.value}
                value={formatPerpsProPrice(
                  position.entryPrice,
                  market.pxDecimals,
                )}
              />
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
              <FittedMetricValue
                textStyle={styles.value}
                value={formatPerpsProPrice(market.markPrice, market.pxDecimals)}
              />
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
              <FittedMetricValue
                containerStyle={styles.rightFittedValue}
                textStyle={styles.value}
                value={displayLiquidationPrice}
              />
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
            <GesturePressable
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
                <Text style={styles.separator}>/</Text>
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
                <View pointerEvents="none" style={styles.editIcon}>
                  <RcIconEdit
                    color={colors2024['neutral-secondary']}
                    height={16}
                    width={16}
                  />
                </View>
              </View>
            </GesturePressable>
          ) : null}
        </View>

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

// Figma 86609:329983 / 87900:107683: 12pt-inset cards, 12pt apart;
// metric labels 12/500, values 14/700.
const METRIC_VALUE_GAP = 6;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  row: {
    ...getPerpsProInfoCardStyle(colors2024, isLight),
    gap: 8,
    marginBottom: 12,
    marginHorizontal: 12,
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
  metrics: { gap: 8 },
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
    fontWeight: '500',
    lineHeight: 16,
  },
  emphasizedValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  positiveValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  negativeValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
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
    height: METRIC_VALUE_GAP + 18,
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
  fittedValueContainer: { alignSelf: 'stretch' },
  rightFittedValue: { alignItems: 'flex-end' },
  value: {
    ...PERPS_PRO_NUMBER_STYLE,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: METRIC_VALUE_FONT_SIZE,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: METRIC_VALUE_GAP,
  },
  marginValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: MARGIN_VALUE_ROW_GAP,
    marginTop: METRIC_VALUE_GAP,
  },
  marginValue: {
    ...PERPS_PRO_NUMBER_STYLE,
    flexShrink: 1,
    minWidth: 0,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: METRIC_VALUE_FONT_SIZE,
    fontWeight: '700',
    lineHeight: 18,
  },
  marginButton: {
    flexShrink: 0,
    alignItems: 'center',
    height: MARGIN_BUTTON_SIZE,
    justifyContent: 'center',
    width: MARGIN_BUTTON_SIZE,
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
    paddingTop: 4,
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
    gap: 2,
    alignItems: 'center',
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
  // 8pt card gap + 8pt = 16pt above the buttons, with or without TP/SL.
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
    paddingTop: 8,
  },
  action: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 6,
    borderCurve: 'continuous',
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionPressed: {
    opacity: 0.8,
  },
  actionText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 18,
    maxWidth: '100%',
    textAlign: 'center',
  },
  disabledActionText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 18,
    maxWidth: '100%',
    textAlign: 'center',
  },
}));
