import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Clipboard from '@react-native-clipboard/clipboard';

import { Text } from '@/components/Typography';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCopyCC } from '@/assets/icons/common';
import { toast } from '@/components2024/Toast';
import type { Chain } from '@/constant/chains';
import type { Account } from '@/core/startupServices/preference';
import { getMessageStyles, SIGN_MESSAGE_CARD_MARGIN } from './styles';
import { HighlightedSignMessageText } from '../SignMessageHighlighter';
import type { SignMessageHighlightToken } from '../signMessageTokenizer';
import type { SignMessageAddressDataMap } from '../signMessageAddressData';
import { Card } from '../Actions/components/Card';

export const SignMessageCard = ({
  title,
  message,
  copyMessage = message,
  hasAction,
  messageTokens,
  chain,
  addressData,
  account,
  approvalViewportHeight,
}: {
  title: string;
  message: string;
  copyMessage?: string;
  hasAction: boolean;
  messageTokens?: SignMessageHighlightToken[];
  chain?: Chain;
  addressData?: SignMessageAddressDataMap;
  account: Account;
  approvalViewportHeight: number;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getMessageStyles(colors), [colors]);

  return (
    <Card
      style={[
        styles.messageCard,
        styles.signMessageCard,
        approvalViewportHeight
          ? {
              maxHeight: Math.max(
                0,
                approvalViewportHeight - SIGN_MESSAGE_CARD_MARGIN * 2,
              ),
            }
          : undefined,
      ]}>
      <View style={styles.messageTitle}>
        <Text
          style={styles.dashLine}
          ellipsizeMode="clip"
          accessible={false}
          numberOfLines={1}>
          - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
          - - - - - - - - - - - - - - - - - - - - - - -
        </Text>

        <View style={styles.messageTitleContent}>
          <Text
            style={[styles.messageTitleText, styles.messageTitleTextWithCopy]}>
            {title}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('global.copy')}
            hitSlop={10}
            onPress={() => {
              Clipboard.setString(copyMessage);
              toast.success(t('global.copied'));
            }}>
            <RcIconCopyCC
              color={colors['neutral-foot']}
              width={14}
              height={14}
            />
          </TouchableOpacity>
        </View>
      </View>
      <BottomSheetScrollView
        nestedScrollEnabled
        style={StyleSheet.flatten([
          styles.signMessageContent,
          hasAction ? {} : styles.noAction,
        ])}>
        <HighlightedSignMessageText
          text={message}
          tokens={messageTokens}
          chain={chain}
          addressData={addressData}
          account={account}
          style={styles.messageText}
          highlightStyle={styles.messageHighlight}
        />
      </BottomSheetScrollView>
    </Card>
  );
};
