import React, { useState } from 'react';
import { Pressable, View, type TextStyle, type StyleProp } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { openExternalUrl } from '@/core/utils/linking';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

type LinkLine = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
const openTradingView = () => openExternalUrl('https://www.tradingview.com');

function TradingViewLink({
  children,
  style,
}: {
  children?: React.ReactNode;
  style: StyleProp<TextStyle>;
}) {
  const text = React.Children.toArray(children).join('');
  const index = text.indexOf('TradingView');
  if (index < 0) return <Text style={style}>{children}</Text>;
  return (
    <>
      {text.slice(0, index)}
      <Text style={style} accessibilityRole="link" onPress={openTradingView}>
        TradingView
      </Text>
      {text.slice(index + 'TradingView'.length)}
    </>
  );
}

// Native Text keeps the original wrapping. Only its link fragments receive
// enlarged targets, measured with the same native font rather than estimated.
function LinkHitArea({
  line,
  start,
  end,
  textStyle,
  topExpansion,
  bottomExpansion,
}: {
  line: LinkLine;
  start: number;
  end: number;
  textStyle: StyleProp<TextStyle>;
  topExpansion: number;
  bottomExpansion: number;
}) {
  const [prefixWidth, setPrefixWidth] = useState<number | null>(
    start === 0 ? 0 : null,
  );
  const [throughWidth, setThroughWidth] = useState<number | null>(null);
  const leftPadding = start === 0 ? 4 : 0;
  const rightPadding = end === line.text.length ? 4 : 0;
  return (
    <>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', width: 10000, opacity: 0 }}>
        {start > 0 && (
          <Text
            style={textStyle}
            onTextLayout={event =>
              setPrefixWidth(event.nativeEvent.lines[0]?.width ?? null)
            }>
            {line.text.slice(0, start)}
          </Text>
        )}
        <Text
          style={textStyle}
          onTextLayout={event =>
            setThroughWidth(event.nativeEvent.lines[0]?.width ?? null)
          }>
          {line.text.slice(0, end)}
        </Text>
      </View>
      {prefixWidth !== null &&
        throughWidth !== null &&
        throughWidth > prefixWidth && (
          <Pressable
            testID="simple-chart-source-link-target"
            accessible={false}
            onPress={openTradingView}
            style={{
              position: 'absolute',
              left: 4 + line.x + prefixWidth - leftPadding,
              top: 16 + line.y - topExpansion,
              width: throughWidth - prefixWidth + leftPadding + rightPadding,
              height: line.height + topExpansion + bottomExpansion,
            }}
          />
        )}
    </>
  );
}

const SourceParagraph = React.memo(function SourceParagraph() {
  const { styles } = useTheme2024({ getStyle });
  const [layout, setLayout] = useState<{ width: number; lines: LinkLine[] }>({
    width: 0,
    lines: [],
  });
  const fullText = layout.lines.map(line => line.text).join('');
  const linkStart = fullText.indexOf('TradingView');
  let offset = 0;
  return (
    <View
      style={styles.source}
      onLayout={event => {
        const width = event.nativeEvent.layout.width;
        setLayout(previous =>
          previous.width === width ? previous : { ...previous, width },
        );
      }}>
      <Text
        style={[styles.link, styles.paragraph]}
        onTextLayout={event => {
          const lines = event.nativeEvent.lines.map(
            ({ text, x, y, width, height }) => ({
              text: text.replace(/\n$/, ''),
              x,
              y,
              width,
              height,
            }),
          );
          setLayout(previous =>
            JSON.stringify(previous.lines) === JSON.stringify(lines)
              ? previous
              : { ...previous, lines },
          );
        }}>
        <Trans
          i18nKey="page.perpsDetail.simpleChart.source"
          components={{
            tradingview: <TradingViewLink style={styles.link} />,
          }}
        />
      </Text>
      {linkStart >= 0 &&
        layout.lines.map((line, index) => {
          const start = Math.max(0, linkStart - offset);
          const end = Math.min(
            line.text.length,
            linkStart + 'TradingView'.length - offset,
          );
          offset += line.text.length;
          return start < end ? (
            <LinkHitArea
              key={`${layout.width}:${fullText}:${index}:${line.x}:${line.y}:${start}:${end}`}
              line={line}
              start={start}
              end={end}
              textStyle={styles.link}
              topExpansion={index === 0 ? 8 : 0}
              bottomExpansion={index === layout.lines.length - 1 ? 8 : 0}
            />
          ) : null;
        })}
    </View>
  );
});

export const PerpsSimpleChartSource = React.memo(
  function PerpsSimpleChartSource() {
    const { i18n } = useTranslation();
    // Trans does not subscribe to language changes itself. A new language also
    // invalidates the old line measurements before any enlarged target is shown.
    return <SourceParagraph key={i18n.resolvedLanguage || i18n.language} />;
  },
);
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  link: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
  },
  source: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  paragraph: { textAlign: 'center' },
}));
