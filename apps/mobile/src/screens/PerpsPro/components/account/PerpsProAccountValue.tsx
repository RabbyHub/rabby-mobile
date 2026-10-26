import { getMeasureTextStyle } from '@/components/AutoShrinkAmountTextSizing';
import { Text } from '@/components/Typography';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import {
  ACCOUNT_VALUE_LINE_HEIGHT,
  resolveAccountValueFit,
} from './perpsProAccountValueSizing';
import type { AccountValueWidths } from './perpsProAccountValueSizing';

type Props = {
  value: string;
  style: StyleProp<TextStyle>;
  testID: string;
  align?: 'left' | 'right';
};

/** Account-only, width-based fitting. Native height-based font fitting stays off. */
export const PerpsProAccountValue = React.memo(
  ({ value, style, testID, align = 'left' }: Props) => {
    const pixelRatio = PixelRatio.get();
    const measureStyle = getMeasureTextStyle(StyleSheet.flatten(style));
    // Account amounts use tabular digits. A cents/tick update with the same
    // separators and sign has identical width; reuse its verified measurement
    // instead of hiding and measuring the live amount on every update.
    const widthIdentity = measureStyle.fontVariant?.includes('tabular-nums')
      ? value.replace(/[0-9]/g, '0')
      : value;
    const measurementKey = JSON.stringify([
      widthIdentity,
      measureStyle,
      pixelRatio,
    ]);
    // Object identity also rejects late A callbacks after A -> B -> A.
    const session = useMemo(() => ({ key: measurementKey }), [measurementKey]);
    const committedSession = useRef<object | null>(null);
    useLayoutEffect(() => {
      committedSession.current = session;
      return () => {
        committedSession.current = null;
      };
    }, [session]);
    const [width, setWidth] = useState(0);
    const [measurement, setMeasurement] = useState<{
      session: object;
      widths: AccountValueWidths;
    }>(() => ({ session, widths: {} }));
    const widths = measurement.session === session ? measurement.widths : {};
    const fit = resolveAccountValueFit(width, widths, pixelRatio);

    return (
      <View
        style={styles.slot}
        testID={`${testID}-slot`}
        onLayout={event => {
          const nextWidth = event.nativeEvent.layout.width;
          if (Number.isFinite(nextWidth) && nextWidth >= 0) {
            setWidth(nextWidth);
          }
        }}>
        <Text
          testID={testID}
          numberOfLines={1}
          ellipsizeMode="clip"
          style={[
            style,
            {
              fontSize: fit.fontSize,
              textAlign: align,
            },
            // Reserve the original line box while measuring; never flash an
            // ellipsis, a wrapped digit, or an unverified clipped amount.
            fit.ready ? styles.visible : styles.hidden,
          ]}>
          {value}
        </Text>
        {fit.measureFontSize != null ? (
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.measure}>
            <Text
              key={`${measurementKey}:${fit.measureFontSize}`}
              accessible={false}
              testID={`${testID}-measure`}
              numberOfLines={1}
              style={[measureStyle, { fontSize: fit.measureFontSize }]}
              onTextLayout={event => {
                if (committedSession.current !== session) {
                  return;
                }
                const measuredWidth = event.nativeEvent.lines[0]?.width;
                const fontSize = fit.measureFontSize;
                if (
                  fontSize == null ||
                  !Number.isFinite(measuredWidth) ||
                  measuredWidth <= 0
                ) {
                  return;
                }
                setMeasurement(previous => {
                  const previousWidths =
                    previous.session === session ? previous.widths : {};
                  if (previousWidths[fontSize] === measuredWidth) {
                    return previous;
                  }
                  return {
                    session,
                    widths: { ...previousWidths, [fontSize]: measuredWidth },
                  };
                });
              }}>
              {value}
            </Text>
          </View>
        ) : null}
      </View>
    );
  },
);

PerpsProAccountValue.displayName = 'PerpsProAccountValue';

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', height: ACCOUNT_VALUE_LINE_HEIGHT },
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
  // Like AutoShrinkAmountText: measure the complete formatted value outside
  // the constrained slot, retaining the actual font/weight/tnum attributes.
  measure: { position: 'absolute', width: 10000, opacity: 0 },
});
