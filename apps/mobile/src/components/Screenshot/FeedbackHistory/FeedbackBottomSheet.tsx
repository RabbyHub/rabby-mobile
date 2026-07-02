import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useFeedbackHistoryVisible } from '../hooks';

import RcIconRabby from '@/assets2024/icons/common/rabby-wallet.svg';
import { RcIconUser } from '@/assets/icons/gnosis';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { FontWeightEnum } from '@/core/utils/fonts';
import { useTheme2024 } from '@/hooks/theme';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { ClientFeedbackMessage } from '@rabby-wallet/rabby-api/dist/types';
import AutoLockView from '../../AutoLockView';
import { AppBottomSheetModal } from '../../customized/BottomSheet';
import { BottomSheetHandlableView } from '../../customized/BottomSheetHandle';
import { useCreation, useRequest } from 'ahooks';
import { openapi } from '@/core/request';
import { makeDeviceUUID } from '@/core/apis/device';
import Video from 'react-native-video';

type FeedbackMessage = {
  id: string;
  role: 'user' | 'support';
  text: string;
  imageUri?: string;
};

const SHEET_HEIGHT = 652;

export const FeedbackBottomSheet: React.FC = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const { isShowHistory, toggleFeedbackHistoryVisible } =
    useFeedbackHistoryVisible();
  const [replyText, setReplyText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToBottom = useCallback((animated = false) => {
    console.log('scrollToBottom', scrollViewRef.current);
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const deviceId = useCreation(() => {
    return makeDeviceUUID().deviceUUID;
  }, []);

  const { data: feedbackMessagesData, runAsync: fetchFeedbackMessages } =
    useRequest(
      async () => {
        return openapi.getClientFeedbackMessages({
          device_id: deviceId,
        });
      },
      {
        cacheKey: `feedbackMessages-${deviceId}`,
        staleTime: 5 * 1000,
        onSuccess: () => {
          // scrollToBottom();
        },
      },
    );

  const { runAsync: handleSubmitReply } = useRequest(
    async () => {
      if (!replyText.trim()) {
        return;
      }

      await openapi.postClientFeedbackMessage({
        device_id: deviceId,
        content: replyText,
        // image_url_list: [
        //   'https://static.debank.com/image/feedback/ac77eb2e68fd49e786a8919862fef3bf/6833c8f1b2904d2e8ea97d652ad8f54a/f88406e1732239ecb024e10c9dc3d9f6.png',
        // ],
      });
    },
    {
      manual: true,
      onSuccess: async () => {
        setReplyText('');
        await fetchFeedbackMessages();
        scrollToBottom();
      },
    },
  );

  useEffect(() => {
    if (isShowHistory) {
      setReplyText('');
      toggleShowSheetModal(true);
      fetchFeedbackMessages();
      scrollToBottom();
    } else {
      toggleShowSheetModal('destroy');
    }
  }, [
    fetchFeedbackMessages,
    isShowHistory,
    scrollToBottom,
    toggleShowSheetModal,
  ]);

  useEffect(() => {
    if (isShowHistory) {
      // scrollToBottom();
    }
  }, [feedbackMessagesData?.messages?.length, isShowHistory, scrollToBottom]);

  return (
    <AppBottomSheetModal
      {...makeBottomSheetProps({
        linearGradientType: 'linear',
        colors: colors2024,
      })}
      ref={sheetModalRef}
      index={0}
      snapPoints={[SHEET_HEIGHT]}
      enableDismissOnClose
      onDismiss={() => {
        toggleFeedbackHistoryVisible(false);
      }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
      enableContentPanningGesture={true}
      enablePanDownToClose={true}>
      <View style={styles.mainContainer}>
        <AutoLockView style={styles.container}>
          <BottomSheetHandlableView style={styles.titleContainer}>
            <Text style={styles.title}>
              {t('page.setting.bugReportHistory')}
            </Text>
          </BottomSheetHandlableView>

          <ScrollView
            ref={scrollViewRef}
            style={styles.messageList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              // setTimeout(() => {
              if (isShowHistory) {
                scrollToBottom();
              }
              // }, 500);
            }}
            contentContainerStyle={styles.messageListContent}>
            {feedbackMessagesData?.messages?.map(message => (
              <FeedbackMessageItem key={message.id} message={message} />
            ))}

            <ReplyComposer
              value={replyText}
              onChangeText={setReplyText}
              onSubmit={handleSubmitReply}
            />
          </ScrollView>

          <View style={styles.footerTipContainer}>
            <Text style={styles.footerTip}>
              {t('component.feedbackHistoryModal.findHistoryTip', {
                defaultValue: 'You can find the history in Settings',
              })}
            </Text>
          </View>
        </AutoLockView>
      </View>
    </AppBottomSheetModal>
  );
};

function FeedbackMessageItem({ message }: { message: ClientFeedbackMessage }) {
  const { styles } = useTheme2024({ getStyle });
  const isSupport =
    message.sender === 'ops' ||
    message.id === '2dc2249ace1e4acc8551ce9a3b46e1a2';

  return (
    <View
      style={[
        styles.messageRow,
        isSupport ? styles.supportMessageRow : styles.userMessageRow,
      ]}>
      {isSupport ? <Avatar role="support" /> : null}
      <View
        style={[
          styles.messageBubble,
          isSupport ? styles.supportBubble : styles.userBubble,
        ]}>
        {!!message.content && (
          <Text
            style={[
              styles.messageText,
              isSupport ? styles.supportMessageText : styles.userMessageText,
            ]}>
            {message.content}
          </Text>
        )}
        {message.image_url_list?.length ? (
          <View style={styles.fileList}>
            {message.image_url_list.map((imageUri, index) => (
              <Image
                key={index}
                source={{ uri: imageUri }}
                style={[styles.feedbackImage]}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : null}
        {message.video_url_list?.length ? (
          <View style={styles.fileList}>
            {message.video_url_list.map((videoUri, index) => (
              <Video
                key={index}
                source={{ uri: videoUri }}
                style={[styles.feedbackImage]}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : null}
      </View>
      {!isSupport ? <Avatar role="user" /> : null}
    </View>
  );
}

function Avatar({ role }: { role: FeedbackMessage['role'] }) {
  const { styles } = useTheme2024({ getStyle });

  if (role === 'support') {
    return (
      <View style={styles.avatar}>
        <RcIconRabby width={32} height={32} />
      </View>
    );
  }

  return (
    <View style={[styles.avatar, styles.userAvatar]}>
      <RcIconUser width={20} height={20} />
    </View>
  );
}

function ReplyComposer({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: (() => void) | (() => Promise<void>);
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={[styles.messageRow, styles.userMessageRow]}>
      <View
        style={[styles.messageBubble, styles.userBubble, styles.replyBubble]}>
        <BottomSheetTextInput
          value={value}
          onChangeText={onChangeText}
          // multiline
          textAlignVertical="top"
          placeholder={t('component.feedbackHistoryModal.replyPlaceholder', {
            defaultValue: 'Enter a new reply... (optional)',
          })}
          placeholderTextColor={styles.replyInputPlaceholder.color}
          style={styles.replyInput}
        />
        <View style={styles.mediaPlaceholder}>
          <Text style={styles.mediaPlaceholderText}>
            {t('component.feedbackHistoryModal.mediaPlaceholder', {
              defaultValue: '+\nImage/Video\n(required)',
            })}
          </Text>
        </View>
        <Button
          title={t('component.screenshotModal.submitButtonText')}
          type="primary"
          height={32}
          onPress={onSubmit}
          containerStyle={styles.replySubmitButtonContainer}
          buttonStyle={styles.replySubmitButton}
          titleStyle={styles.replySubmitButtonTitle}
        />
      </View>
      <Avatar role="user" />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  mainContainer: {
    height: '100%',
    maxHeight: SHEET_HEIGHT,
  },
  container: {
    flex: 1,
  },
  titleContainer: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  messageList: {
    flex: 1,
    width: '100%',
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
    paddingLeft: 44,
  },
  supportMessageRow: {
    justifyContent: 'flex-start',
    paddingRight: 44,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  messageBubble: {
    borderRadius: 12,
    padding: 12,
    minWidth: 0,
    flex: 1,
  },
  userBubble: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  supportBubble: {
    backgroundColor: colors2024['brand-light-1'],
  },
  messageText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
  },
  userMessageText: {
    // fontWeight: FontWeightEnum.bold,
  },
  supportMessageText: {
    // fontWeight: FontWeightEnum.medium,
  },
  fileList: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  feedbackImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-5'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  imageWithText: {
    marginTop: 7,
  },
  replyBubble: {},
  replyInput: {
    // height: 42,
    width: '100%',
    padding: 0,
    // fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
  },
  replyInputPlaceholder: {
    color: colors2024['neutral-secondary'],
  },
  mediaPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginTop: 0,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  mediaPlaceholderText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
  replySubmitButtonContainer: {
    width: 80,
    height: 32,
    alignSelf: 'flex-end',
    marginTop: 7,
  },
  replySubmitButton: {
    height: 32,
    borderRadius: 8,
  },
  replySubmitButtonTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: FontWeightEnum.bold,
  },
  footerTipContainer: {
    height: 68,
    alignItems: 'center',
    paddingTop: 16,
  },
  footerTip: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: FontWeightEnum.medium,
    color: colors2024['neutral-secondary'],
  },
}));
