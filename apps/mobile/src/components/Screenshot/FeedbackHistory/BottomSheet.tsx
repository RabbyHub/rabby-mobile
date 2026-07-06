import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import {
  getScreenshotFeedbackExtraSafely,
  useFeedbackHistoryVisible,
  useScreenshotFeedbackTotalBalanceText,
} from '../hooks';

import RcCloseIcon from '@/assets/icons/feedback/close-light.svg';
import RcRabbyAvatar from '@/assets/icons/feedback/rabby-avatar.svg';
import RcUserAvatar from '@/assets/icons/feedback/user-avatar.svg';
import { Text, TextInput } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { toast } from '@/components2024/Toast';
import { makeDeviceUUID } from '@/core/apis/device';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import type { ClientFeedbackMessage } from '@rabby-wallet/rabby-api/dist/types';
import { useCreation, useRequest } from 'ahooks';
import { sortBy } from 'lodash';
import FastImage from 'react-native-fast-image';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from 'react-native-keyboard-controller';
import Video from 'react-native-video';
import AutoLockView from '../../AutoLockView';
import { AppBottomSheetModal } from '../../customized/BottomSheet';
import { BottomSheetHandlableView } from '../../customized/BottomSheetHandle';

const SHEET_HEIGHT = 652;
const ONE_MB = 1024 * 1024;
const MAX_IMAGE_FILE_SIZE = 5 * ONE_MB;
const MAX_VIDEO_FILE_SIZE = 50 * ONE_MB;

type PickedFeedbackMedia = Asset;

function isVideoMedia(media?: PickedFeedbackMedia | null) {
  const filename = media?.fileName || media?.uri || '';
  return (
    media?.type?.startsWith('video/') ||
    /\.(mp4|mov|m4v|webm|3gp)$/i.test(filename)
  );
}

function getUploadFilename(media: PickedFeedbackMedia) {
  if (media.fileName) {
    return media.fileName;
  }

  return isVideoMedia(media) ? 'feedback-video.mp4' : 'feedback-image.jpg';
}

function getUploadMimeType(media: PickedFeedbackMedia) {
  if (media.type) {
    return media.type;
  }

  return isVideoMedia(media) ? 'video/mp4' : 'image/jpeg';
}

function getMediaSizeLimitError(media: PickedFeedbackMedia) {
  if (!media.fileSize) {
    return null;
  }

  if (isVideoMedia(media)) {
    return media.fileSize > MAX_VIDEO_FILE_SIZE
      ? 'Video size must be 50 MB or smaller.'
      : null;
  }

  return media.fileSize > MAX_IMAGE_FILE_SIZE
    ? 'Image size must be 5 MB or smaller.'
    : null;
}

function getFeedbackErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as {
    message?: unknown;
    response?: {
      data?: {
        message?: unknown;
        error?: unknown;
      };
    };
  };
  const message =
    maybeError?.response?.data?.message ||
    maybeError?.response?.data?.error ||
    maybeError?.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function uploadFeedbackMedia(media: PickedFeedbackMedia) {
  if (!media.uri) {
    throw new Error('No selected feedback media uri');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: media.uri,
    type: getUploadMimeType(media),
    name: getUploadFilename(media),
  } as unknown as Blob);

  return openapi.uploadClientFeedback(formData, true);
}

export const FeedbackHistoryBottomSheet: React.FC = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const { isShowHistory, toggleFeedbackHistoryVisible } =
    useFeedbackHistoryVisible();
  const totalBalanceText = useScreenshotFeedbackTotalBalanceText();
  const [replyText, setReplyText] = useState('');
  const [selectedMedia, setSelectedMedia] =
    useState<PickedFeedbackMedia | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingScrollToBottomRef = useRef(false);
  const scrollToBottom = useCallback((animated = false) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  }, []);
  const requestScrollToBottomAfterLayout = useCallback(
    (animated = false) => {
      pendingScrollToBottomRef.current = true;
      scrollToBottom(animated);
    },
    [scrollToBottom],
  );
  const handleScrollViewContentSizeChange = useCallback(() => {
    if (!isShowHistory || !pendingScrollToBottomRef.current) {
      return;
    }

    scrollToBottom();
    pendingScrollToBottomRef.current = false;
  }, [isShowHistory, scrollToBottom]);

  const handlePickMedia = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorCode) {
      console.error(
        'launchImageLibrary error',
        result.errorCode,
        result.errorMessage,
      );
      toast.error(result.errorMessage || 'Failed to open photo library.');
      return;
    }

    const media = result.assets?.find(asset => !!asset.uri);
    if (media) {
      const limitError = getMediaSizeLimitError(media);
      if (limitError) {
        toast.error(limitError);
        return;
      }

      setSelectedMedia(media);
    }
  }, []);

  const handleRemoveMedia = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const deviceId = useCreation(() => {
    return makeDeviceUUID().deviceUUID;
  }, []);

  const { data: feedbackMessagesData, runAsync: fetchFeedbackMessages } =
    useRequest(
      async () => {
        const res = await openapi.getClientFeedbackMessages({
          device_id: deviceId,
          limit: 100,
        });
        res.messages = sortBy(res.messages, m => m.create_at);
        return res;
      },
      {
        cacheKey: `feedbackMessages-${deviceId}`,
        staleTime: 5 * 1000,
        ready: isShowHistory,
        onSuccess: () => {
          requestScrollToBottomAfterLayout();
        },
      },
    );

  const { runAsync: handleSubmitReply, loading: isSubmittingReply } =
    useRequest(
      async () => {
        const content = replyText.trim();
        if (!selectedMedia) {
          throw new Error('No selected feedback media to upload');
        }

        const uploadResult = await uploadFeedbackMedia(selectedMedia);
        const imageUrlList = uploadResult?.image_url
          ? [uploadResult.image_url]
          : undefined;
        const videoUrlList = uploadResult?.video_url
          ? [uploadResult.video_url]
          : undefined;

        if (!imageUrlList && !videoUrlList) {
          throw new Error('Feedback media upload did not return a media url');
        }

        const extraInfo = await getScreenshotFeedbackExtraSafely(
          totalBalanceText,
        );

        await openapi.postClientFeedbackMessage({
          device_id: deviceId,
          content: content || undefined,
          image_url_list: imageUrlList,
          video_url_list: videoUrlList,
          extra: extraInfo,
        });
      },
      {
        manual: true,
        onSuccess: async () => {
          setReplyText('');
          setSelectedMedia(null);
          toast.success(t('component.submitFeedbackSuccessModal.desc'), {
            hideOnPress: true,
          });
          await fetchFeedbackMessages();
          requestScrollToBottomAfterLayout();
        },
        onError: error => {
          console.log('feedback', error);
          console.error('feedback reply submission error', error);
          toast.error(getFeedbackErrorMessage(error, 'Upload failed.'));
        },
      },
    );

  useEffect(() => {
    if (isShowHistory) {
      setReplyText('');
      setSelectedMedia(null);
      toggleShowSheetModal(true);
      fetchFeedbackMessages();
      requestScrollToBottomAfterLayout();
    } else {
      toggleShowSheetModal('destroy');
    }
  }, [
    fetchFeedbackMessages,
    isShowHistory,
    requestScrollToBottomAfterLayout,
    toggleShowSheetModal,
  ]);

  const hasMessage = useMemo(() => {
    return !!feedbackMessagesData?.messages?.length;
  }, [feedbackMessagesData?.messages?.length]);

  useEffect(() => {
    if (isShowHistory && hasMessage) {
      requestScrollToBottomAfterLayout();
    }
  }, [hasMessage, isShowHistory, requestScrollToBottomAfterLayout]);

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
      // keyboardBehavior="extend"
      // keyboardBlurBehavior="restore"
      // android_keyboardInputMode="adjustPan"
      enableContentPanningGesture={false}
      enablePanDownToClose={true}>
      <View style={styles.mainContainer}>
        <AutoLockView style={styles.container}>
          <KeyboardProvider>
            <BottomSheetHandlableView style={styles.titleContainer}>
              <Text style={styles.title}>
                {t('page.setting.bugReportHistory')}
              </Text>
            </BottomSheetHandlableView>

            <KeyboardAwareScrollView
              ref={scrollViewRef}
              style={styles.messageList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bottomOffset={14}
              onContentSizeChange={handleScrollViewContentSizeChange}
              contentContainerStyle={styles.messageListContent}>
              {feedbackMessagesData?.messages?.map(message => (
                <FeedbackMessageItem key={message.id} message={message} />
              ))}

              <ReplyComposer
                value={replyText}
                onChangeText={setReplyText}
                selectedMedia={selectedMedia}
                onPickMedia={handlePickMedia}
                onRemoveMedia={handleRemoveMedia}
                onSubmit={handleSubmitReply}
                submitting={isSubmittingReply}
              />
            </KeyboardAwareScrollView>

            <View style={styles.footerTipContainer}>
              <Text style={styles.footerTip}>
                {t('component.feedbackHistoryModal.findHistoryTip', {
                  defaultValue: 'You can find the history in Settings',
                })}
              </Text>
            </View>
          </KeyboardProvider>
        </AutoLockView>
      </View>
    </AppBottomSheetModal>
  );
};

function FeedbackMessageItem({ message }: { message: ClientFeedbackMessage }) {
  const { styles } = useTheme2024({ getStyle });
  const isSupport = message.sender === 'ops';

  return (
    <View
      style={[
        styles.messageRow,
        isSupport ? styles.supportMessageRow : styles.userMessageRow,
      ]}>
      {isSupport ? <RcRabbyAvatar style={styles.avatar} /> : null}
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
              <FastImage
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
                paused
                muted
              />
            ))}
          </View>
        ) : null}
      </View>
      {!isSupport ? <RcUserAvatar style={styles.avatar} /> : null}
    </View>
  );
}

function ReplyComposer({
  value,
  onChangeText,
  selectedMedia,
  onPickMedia,
  onRemoveMedia,
  onSubmit,
  submitting,
}: {
  value: string;
  onChangeText: (text: string) => void;
  selectedMedia?: PickedFeedbackMedia | null;
  onPickMedia: () => void | Promise<void>;
  onRemoveMedia: () => void;
  onSubmit?: (() => void) | (() => Promise<void>);
  submitting?: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const selectedMediaUri = selectedMedia?.uri;

  return (
    <View style={[styles.messageRow, styles.userMessageRow]}>
      <View
        style={[styles.messageBubble, styles.userBubble, styles.replyBubble]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          // multiline
          textAlignVertical="top"
          placeholder={t('component.feedbackHistoryModal.replyPlaceholder', {
            defaultValue: 'Enter a new reply... (optional)',
          })}
          placeholderTextColor={styles.replyInputPlaceholder.color}
          style={styles.replyInput}
          enterKeyHint="send"
          onSubmitEditing={() => {
            if (selectedMedia) {
              onSubmit?.();
            }
          }}
        />
        {selectedMediaUri ? (
          <View style={styles.mediaPreviewContainer}>
            {isVideoMedia(selectedMedia) ? (
              <Video
                source={{ uri: selectedMediaUri }}
                style={styles.mediaPreview}
                resizeMode="cover"
                paused
                muted
              />
            ) : (
              <FastImage
                source={{ uri: selectedMediaUri }}
                style={styles.mediaPreview}
                resizeMode="cover"
              />
            )}
            <View style={styles.removeMediaButton}>
              <TouchableOpacity onPress={onRemoveMedia} disabled={submitting}>
                <RcCloseIcon width={21} height={21} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={onPickMedia} disabled={submitting}>
            <View style={styles.mediaPlaceholder}>
              <Text style={styles.mediaPlaceholderText}>+</Text>
              <Text style={styles.mediaPlaceholderText}>
                {t('component.feedbackHistoryModal.mediaPlaceholder', {
                  defaultValue: 'Image/Video\n(required)',
                })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <Button
          title={t('component.screenshotModal.submitButtonText')}
          type="primary"
          height={32}
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting || !selectedMediaUri}
          containerStyle={styles.replySubmitButtonContainer}
          buttonStyle={styles.replySubmitButton}
          titleStyle={styles.replySubmitButtonTitle}
        />
      </View>
      <RcUserAvatar style={styles.avatar} />
    </View>
  );
}

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
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
    paddingBottom: 0,
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
    flexShrink: 0,
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
  mediaPreviewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  mediaPreview: {
    width: 80,
    height: 80,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors2024['neutral-bg-5'],
  },
  removeMediaButton: {
    position: 'absolute',
    top: -5,
    right: -2,
    width: 21,
    height: 21,
    borderRadius: 21,
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
    fontWeight: '700',
  },
  footerTipContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: Math.max(safeAreaInsets.bottom, 36),
  },
  footerTip: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
}));
