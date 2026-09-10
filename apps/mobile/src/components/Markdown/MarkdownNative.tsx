import { useMemo } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';

import { Text } from '@/components/Typography';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { parseMarkdown } from './parseMarkdown';
import type { MarkdownBlock, MarkdownParseResult } from './parseMarkdown';

const HEADING_FONT_SIZES = [28, 22, 18, 16, 15, 14] as const;
const BODY_FONT_SIZE = 14;
const BODY_LINE_HEIGHT = 18;

export function MarkdownNative({
  markdown,
  parsedMarkdown,
  style,
  contentContainerStyle,
  textColor,
  headingColor,
  fontFamily,
}: React.PropsWithoutRef<{
  markdown: string;
  parsedMarkdown?: MarkdownParseResult;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  textColor?: string;
  headingColor?: string;
  fontFamily?: string;
}>) {
  const { styles, colors } = useThemeStyles(getStyles);
  const parsed = useMemo(
    () => parsedMarkdown ?? parseMarkdown(markdown),
    [markdown, parsedMarkdown],
  );

  const bodyColor = textColor ?? colors['neutral-body'];
  const titleColor = headingColor ?? colors['neutral-title-1'];

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}>
      {parsed.blocks.map((block, index) => (
        <MarkdownBlockView
          key={index}
          block={block}
          isFirst={index === 0}
          bodyColor={bodyColor}
          titleColor={titleColor}
          fontFamily={fontFamily}
        />
      ))}
    </ScrollView>
  );
}

function MarkdownBlockView({
  block,
  isFirst,
  bodyColor,
  titleColor,
  fontFamily,
}: {
  block: MarkdownBlock;
  isFirst: boolean;
  bodyColor: string;
  titleColor: string;
  fontFamily?: string;
}) {
  const { styles } = useThemeStyles(getStyles);

  switch (block.type) {
    case 'heading': {
      const fontSize =
        HEADING_FONT_SIZES[Math.min(Math.max(block.level, 1), 6) - 1] ??
        BODY_FONT_SIZE;
      return (
        <Text
          style={[
            styles.heading,
            {
              color: titleColor,
              fontFamily,
              fontSize,
              lineHeight: Math.round(fontSize * 1.4),
              marginTop: isFirst ? 0 : 16,
            },
          ]}>
          {block.text}
        </Text>
      );
    }
    case 'list':
      return (
        <View>
          {block.items.map((item, itemIndex) => (
            <View key={itemIndex} style={styles.listItem}>
              <Text
                style={[
                  block.ordered ? styles.orderedMarker : styles.unorderedMarker,
                  { color: bodyColor, fontFamily },
                ]}>
                {block.ordered ? `${item.order}.` : '•'}
              </Text>
              <Text
                style={[
                  styles.bodyText,
                  styles.listItemText,
                  { color: bodyColor, fontFamily },
                ]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      );
    default:
      if (!block.text) {
        return <View style={styles.emptyLine} />;
      }
      return (
        <Text style={[styles.bodyText, { color: bodyColor, fontFamily }]}>
          {block.text}
        </Text>
      );
  }
}

const getStyles = createGetStyles(colors => ({
  container: {
    minHeight: 200,
    maxHeight: '100%',
    height: '100%',
    width: '100%',
    backgroundColor: colors['neutral-bg-1'],
  },
  contentContainer: {
    paddingLeft: 5,
  },
  heading: {
    fontWeight: '600',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: BODY_FONT_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
  },
  emptyLine: {
    height: BODY_LINE_HEIGHT,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  unorderedMarker: {
    width: 22,
    textAlign: 'center',
    fontSize: BODY_FONT_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
  },
  orderedMarker: {
    width: 22,
    paddingRight: 6,
    textAlign: 'right',
    fontSize: BODY_FONT_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
  },
  listItemText: {
    flex: 1,
    paddingLeft: 2,
  },
}));
