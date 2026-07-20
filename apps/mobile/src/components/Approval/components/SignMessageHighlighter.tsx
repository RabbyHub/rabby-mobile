import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  type TextProps,
} from 'react-native';

import { Text } from '@/components/Typography';
import { useOpenTokenDetailSheetModalOnApprovals } from '@/components/TokenDetailPopup/hooks';
import type { Chain } from '@/constant/chains';
import type { Account } from '@/types/account';
import {
  tokenizeSignMessageText,
  type SignMessageHighlightToken,
} from './signMessageTokenizer';
import {
  getSignMessageAddressTagLayouts,
  getSignMessageAddressTagType,
  type SignMessageAddressDataMap,
} from './signMessageAddressData';
import { SignMessageAddressTag } from './SignMessageAddressTag';

export const HighlightedSignMessageText = ({
  text,
  highlightStyle,
  tokens,
  chain,
  addressData,
  account,
  onTextLayout,
  ...props
}: TextProps & {
  text: string;
  highlightStyle?: TextProps['style'];
  tokens?: SignMessageHighlightToken[];
  chain?: Chain;
  addressData?: SignMessageAddressDataMap;
  account?: Account;
}) => {
  const openTokenDetailPopup = useOpenTokenDetailSheetModalOnApprovals();
  const resolvedTokens = useMemo(
    () => tokens || tokenizeSignMessageText(text),
    [text, tokens],
  );
  const [lines, setLines] = useState<
    Array<{ text: string; y: number; height: number }>
  >([]);
  const addressTags = useMemo(() => {
    if (!chain || !account) return [];

    return resolvedTokens.flatMap((token, index) => {
      if (token.type !== 'address') return [];
      const address = token.address || token.value;
      const data = addressData?.[address.toLowerCase()];
      return data && getSignMessageAddressTagType(data)
        ? [{ index, data }]
        : [];
    });
  }, [account, addressData, chain, resolvedTokens]);
  const layouts = useMemo(
    () =>
      getSignMessageAddressTagLayouts(
        resolvedTokens,
        addressTags.map(tag => tag.index),
        lines,
      ),
    [addressTags, lines, resolvedTokens],
  );
  const layoutByTokenIndex = useMemo(
    () => new Map(layouts.map(layout => [layout.index, layout])),
    [layouts],
  );
  const handleTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const nextLines = event.nativeEvent.lines.map(line => ({
        text: line.text,
        y: line.y,
        height: line.height,
      }));
      setLines(current =>
        current.length === nextLines.length &&
        current.every(
          (line, index) =>
            line.text === nextLines[index].text &&
            line.y === nextLines[index].y &&
            line.height === nextLines[index].height,
        )
          ? current
          : nextLines,
      );
      onTextLayout?.(event);
    },
    [onTextLayout],
  );

  return (
    <View style={styles.container}>
      <Text {...props} onTextLayout={handleTextLayout}>
        {resolvedTokens.map((token, index) =>
          token.type === 'text' ? (
            <React.Fragment key={`text-${index}`}>{token.value}</React.Fragment>
          ) : (
            <Text key={`${token.type}-${index}`} style={highlightStyle}>
              {token.value}
            </Text>
          ),
        )}
      </Text>
      {chain && account && addressTags.length ? (
        <View pointerEvents="box-none" style={styles.tagRail}>
          {addressTags.map(({ index, data }) => {
            const layout = layoutByTokenIndex.get(index);
            return layout ? (
              <View
                key={`${index}-${data.address}`}
                style={[
                  styles.tag,
                  {
                    right: layout.right,
                    top: layout.top - 3,
                  },
                ]}>
                <SignMessageAddressTag
                  chain={chain}
                  data={data}
                  onOpenTokenDetail={token =>
                    openTokenDetailPopup(token, account)
                  }
                />
              </View>
            ) : null;
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  tagRail: {
    ...StyleSheet.absoluteFillObject,
    right: -24,
  },
  tag: {
    position: 'absolute',
    zIndex: 2,
  },
});
