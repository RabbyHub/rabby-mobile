import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  ScrollView,
  View,
} from 'react-native';

import {
  getScreenshotFeedbackExtraSafely,
  useFeedbackHistoryVisible,
  useScreenshotFeedbackTotalBalanceText,
} from '../hooks';
import {
  FeedbackMediaPreview,
  type FeedbackPreviewMedia,
} from './MediaPreview';

import RcCloseIconLight from '@/assets/icons/feedback/close.svg';
import RcCloseIconDark from '@/assets/icons/feedback/close-dark.svg';
import RcRabbyAvatarLight from '@/assets/icons/feedback/rabby-avatar.svg';
import RcRabbyAvatarDark from '@/assets/icons/feedback/rabby-avatar-dark.svg';
import RcUserAvatarLight from '@/assets/icons/feedback/user-avatar.svg';
import RcUserAvatarDark from '@/assets/icons/feedback/user-avatar-dark.svg';
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
type UploadedFeedbackMediaUrls = {
  imageUrlList?: string[];
  videoUrlList?: string[];
};

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

  console.log('-------start--------', Date.now());
  const formData = new FormData();
  formData.append('file', {
    uri: media.uri,
    type: getUploadMimeType(media),
    name: getUploadFilename(media),
  } as unknown as Blob);
  console.log('-------append--------', Date.now());

  const res = await openapi.uploadClientFeedback(formData, true);
  console.log('----------end--------', Date.now());
  return res;
}

function getUploadedFeedbackMediaUrls(uploadResult?: {
  image_url?: string;
  video_url?: string;
}): UploadedFeedbackMediaUrls {
  return {
    imageUrlList: uploadResult?.image_url
      ? [uploadResult.image_url]
      : undefined,
    videoUrlList: uploadResult?.video_url
      ? [uploadResult.video_url]
      : undefined,
  };
}

function hasUploadedFeedbackMediaUrls(urls?: UploadedFeedbackMediaUrls | null) {
  return !!urls?.imageUrlList?.length || !!urls?.videoUrlList?.length;
}

export const FeedbackHistoryBottomSheet: React.FC = () => {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const {
    isShowHistory,
    feedbackHistoryRefreshKey,
    toggleFeedbackHistoryVisible,
  } = useFeedbackHistoryVisible();
  const totalBalanceText = useScreenshotFeedbackTotalBalanceText();
  const [selectedMedia, setSelectedMedia] =
    useState<PickedFeedbackMedia | null>(null);
  const [uploadedMediaUrls, setUploadedMediaUrls] =
    useState<UploadedFeedbackMediaUrls | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<FeedbackPreviewMedia | null>(
    null,
  );
  const replyTextRef = useRef('');
  const replyInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingScrollToBottomRef = useRef(false);
  const mediaUploadRequestIdRef = useRef(0);
  const handleReplyTextChange = useCallback((text: string) => {
    replyTextRef.current = text;
  }, []);
  const clearReplyText = useCallback(() => {
    replyTextRef.current = '';
    replyInputRef.current?.clear();
  }, []);
  const scrollToBottom = useCallback((animated = false) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated });
      });
    }, 200);
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

  const resetSelectedMedia = useCallback(() => {
    mediaUploadRequestIdRef.current += 1;
    setSelectedMedia(null);
    setUploadedMediaUrls(null);
    setIsUploadingMedia(false);
  }, []);

  const uploadSelectedMedia = useCallback(
    async (media: PickedFeedbackMedia, requestId: number) => {
      setIsUploadingMedia(true);
      setUploadedMediaUrls(null);

      try {
        const uploadResult = await uploadFeedbackMedia(media);
        const mediaUrls = getUploadedFeedbackMediaUrls(uploadResult);

        if (!hasUploadedFeedbackMediaUrls(mediaUrls)) {
          throw new Error('Feedback media upload did not return a media url');
        }

        if (requestId !== mediaUploadRequestIdRef.current) {
          return;
        }

        setUploadedMediaUrls(mediaUrls);
      } catch (error) {
        if (requestId !== mediaUploadRequestIdRef.current) {
          return;
        }

        console.error('feedback media upload error', error);
        toast.error(getFeedbackErrorMessage(error, 'Upload failed.'));
        setSelectedMedia(null);
        setUploadedMediaUrls(null);
      } finally {
        if (requestId === mediaUploadRequestIdRef.current) {
          setIsUploadingMedia(false);
        }
      }
    },
    [],
  );

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

      const requestId = mediaUploadRequestIdRef.current + 1;
      mediaUploadRequestIdRef.current = requestId;
      setSelectedMedia(media);
      setUploadedMediaUrls(null);
      void uploadSelectedMedia(media, requestId);
    }
  }, [uploadSelectedMedia]);

  const handleRemoveMedia = useCallback(() => {
    resetSelectedMedia();
  }, [resetSelectedMedia]);
  const handleOpenMediaPreview = useCallback((media: FeedbackPreviewMedia) => {
    setPreviewMedia(media);
  }, []);
  const handleCloseMediaPreview = useCallback(() => {
    setPreviewMedia(null);
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
        manual: true,
        cacheKey: `feedbackMessages-${deviceId}`,
        staleTime: 5 * 1000,
        onSuccess: () => {
          requestScrollToBottomAfterLayout();
        },
      },
    );

  const {
    runAsync: handleSubmitReply,
    loading: isSubmittingReply,
    cancel: cancelSubmitReply,
  } = useRequest(
    async () => {
      const content = replyTextRef.current.trim();
      if (!selectedMedia) {
        throw new Error('No selected feedback media to upload');
      }

      if (isUploadingMedia) {
        throw new Error('Feedback media is still uploading.');
      }

      if (!hasUploadedFeedbackMediaUrls(uploadedMediaUrls)) {
        throw new Error('No uploaded feedback media url');
      }
      Keyboard.dismiss();

      const extraInfo = await getScreenshotFeedbackExtraSafely(
        totalBalanceText,
      );

      await openapi.postClientFeedbackMessage({
        device_id: deviceId,
        content: content || undefined,
        image_url_list: uploadedMediaUrls?.imageUrlList,
        video_url_list: uploadedMediaUrls?.videoUrlList,
        extra: extraInfo,
      });
    },
    {
      manual: true,
      onSuccess: async () => {
        clearReplyText();
        resetSelectedMedia();
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
      clearReplyText();
      resetSelectedMedia();
      toggleShowSheetModal(true);
    } else {
      cancelSubmitReply();
      resetSelectedMedia();
      setPreviewMedia(null);
      toggleShowSheetModal('destroy');
    }
  }, [
    clearReplyText,
    cancelSubmitReply,
    isShowHistory,
    resetSelectedMedia,
    toggleShowSheetModal,
  ]);

  useEffect(() => {
    if (!isShowHistory) {
      return;
    }

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        toggleFeedbackHistoryVisible(false);
        return true;
      },
    );

    return () => {
      backSubscription.remove();
    };
  }, [isShowHistory, toggleFeedbackHistoryVisible]);

  useEffect(() => {
    if (!isShowHistory) {
      return;
    }

    fetchFeedbackMessages();
    requestScrollToBottomAfterLayout();
  }, [
    feedbackHistoryRefreshKey,
    fetchFeedbackMessages,
    isShowHistory,
    requestScrollToBottomAfterLayout,
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
    <>
      <AppBottomSheetModal
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: isLight ? 'bg1' : 'bg1',
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
                bottomOffset={146}
                onContentSizeChange={handleScrollViewContentSizeChange}
                contentContainerStyle={styles.messageListContent}>
                {feedbackMessagesData?.messages?.map(message => (
                  <FeedbackMessageItem
                    key={message.id}
                    message={message}
                    onPreviewMedia={handleOpenMediaPreview}
                  />
                ))}

                <ReplyComposer
                  key="reply-composer"
                  inputRef={replyInputRef}
                  onChangeText={handleReplyTextChange}
                  selectedMedia={selectedMedia}
                  mediaUploadReady={hasUploadedFeedbackMediaUrls(
                    uploadedMediaUrls,
                  )}
                  uploadingMedia={isUploadingMedia}
                  onPickMedia={handlePickMedia}
                  onRemoveMedia={handleRemoveMedia}
                  onPreviewMedia={handleOpenMediaPreview}
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

      {previewMedia ? (
        <FeedbackMediaPreview
          media={previewMedia}
          onClose={handleCloseMediaPreview}
        />
      ) : null}
    </>
  );
};

const Avatar: React.FC<{
  isUser?: boolean;
}> = ({ isUser }) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  if (isUser) {
    return isLight ? (
      <RcUserAvatarLight style={styles.avatar} />
    ) : (
      <RcUserAvatarDark style={styles.avatar} />
    );
  }
  return isLight ? (
    <RcRabbyAvatarLight style={styles.avatar} />
  ) : (
    <RcRabbyAvatarDark style={styles.avatar} />
  );
};

function FeedbackMessageItem({
  message,
  onPreviewMedia,
}: {
  message: ClientFeedbackMessage;
  onPreviewMedia: (media: FeedbackPreviewMedia) => void;
}) {
  const { styles, isLight } = useTheme2024({ getStyle });
  const isSupport = message.sender === 'ops';

  return (
    <View
      style={[
        styles.messageRow,
        isSupport ? styles.supportMessageRow : styles.userMessageRow,
      ]}>
      {isSupport ? <Avatar /> : null}
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
              <TouchableOpacity
                key={index}
                activeOpacity={0.85}
                onPress={() =>
                  onPreviewMedia({ type: 'image', uri: imageUri })
                }>
                <FastImage
                  source={{ uri: imageUri }}
                  style={styles.feedbackImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {message.video_url_list?.length ? (
          <View style={styles.fileList}>
            {message.video_url_list.map((videoUri, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.85}
                onPress={() =>
                  onPreviewMedia({ type: 'video', uri: videoUri })
                }>
                <View>
                  <Video
                    source={{ uri: videoUri }}
                    style={styles.feedbackImage}
                    resizeMode="cover"
                    paused
                    muted
                  />
                  <View style={styles.videoPlayBadge}>
                    <View style={styles.videoPlayTriangle} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
      {!isSupport ? <Avatar isUser /> : null}
    </View>
  );
}

function ReplyComposer({
  inputRef,
  onChangeText,
  selectedMedia,
  onPickMedia,
  onRemoveMedia,
  onPreviewMedia,
  onSubmit,
  submitting,
  uploadingMedia,
  mediaUploadReady,
}: {
  inputRef: React.Ref<React.ComponentRef<typeof TextInput>>;
  onChangeText: (text: string) => void;
  selectedMedia?: PickedFeedbackMedia | null;
  mediaUploadReady?: boolean;
  uploadingMedia?: boolean;
  onPickMedia: () => void | Promise<void>;
  onRemoveMedia: () => void;
  onPreviewMedia: (media: FeedbackPreviewMedia) => void;
  onSubmit?: (() => void) | (() => Promise<void>);
  submitting?: boolean;
}) {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const selectedMediaUri = selectedMedia?.uri;
  const isSelectedVideo = isVideoMedia(selectedMedia);
  const handlePreviewSelectedMedia = useCallback(() => {
    if (uploadingMedia) {
      return;
    }

    if (!selectedMediaUri) {
      return;
    }

    onPreviewMedia({
      type: isSelectedVideo ? 'video' : 'image',
      uri: selectedMediaUri,
    });
  }, [isSelectedVideo, onPreviewMedia, selectedMediaUri, uploadingMedia]);

  return (
    <View style={[styles.messageRow, styles.userMessageRow]}>
      <View
        style={[styles.messageBubble, styles.userBubble, styles.replyBubble]}>
        <TextInput
          ref={inputRef}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
          placeholder={t('component.feedbackHistoryModal.replyPlaceholder', {
            defaultValue: 'Enter a new reply... (optional)',
          })}
          placeholderTextColor={styles.replyInputPlaceholder.color}
          style={styles.replyInput}
          enterKeyHint="send"
          onSubmitEditing={() => {
            if (selectedMedia && mediaUploadReady && !uploadingMedia) {
              onSubmit?.();
            }
          }}
        />
        {selectedMediaUri ? (
          <View style={styles.mediaPreviewContainer}>
            <TouchableOpacity
              activeOpacity={uploadingMedia ? 1 : 0.85}
              disabled={uploadingMedia}
              onPress={handlePreviewSelectedMedia}>
              {isSelectedVideo ? (
                <View>
                  <Video
                    source={{ uri: selectedMediaUri }}
                    style={styles.mediaPreview}
                    resizeMode="cover"
                    paused
                    muted
                  />
                  {!uploadingMedia ? (
                    <View style={styles.videoPlayBadge}>
                      <View style={styles.videoPlayTriangle} />
                    </View>
                  ) : null}
                </View>
              ) : (
                <FastImage
                  source={{ uri: selectedMediaUri }}
                  style={styles.mediaPreview}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>

            {uploadingMedia ? (
              <View pointerEvents="none" style={styles.mediaUploadMask}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : null}
            <View style={styles.removeMediaButton}>
              <TouchableOpacity onPress={onRemoveMedia} disabled={submitting}>
                {isLight ? (
                  <RcCloseIconLight width={21} height={21} />
                ) : (
                  <RcCloseIconDark width={21} height={21} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.mediaPlaceholderContainer}>
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
          </View>
        )}
        <Button
          title={t('component.screenshotModal.submitButtonText')}
          type="primary"
          height={32}
          onPress={onSubmit}
          loading={submitting}
          disabled={
            submitting ||
            uploadingMedia ||
            !selectedMediaUri ||
            !mediaUploadReady
          }
          containerStyle={styles.replySubmitButtonContainer}
          buttonStyle={styles.replySubmitButton}
          titleStyle={styles.replySubmitButtonTitle}
        />
      </View>
      <Avatar isUser />
    </View>
  );
}

const getStyle = createGetStyles2024(
  ({ colors2024, safeAreaInsets, isLight }) => ({
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
      backgroundColor: isLight
        ? colors2024['brand-light-1']
        : colors2024['brand-light-2'],
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
    videoPlayBadge: {
      position: 'absolute',
      top: 31,
      left: 31,
      width: 20,
      height: 20,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.40)',
      borderWidth: 1,
      borderColor: colors2024['neutral-bg-1'],
    },
    videoPlayTriangle: {
      width: 0,
      height: 0,
      marginLeft: 2,
      borderTopWidth: 4,
      borderBottomWidth: 4,
      borderLeftWidth: 7,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: colors2024['neutral-bg-1'],
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
    mediaPlaceholderContainer: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'flex-start',
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
    mediaUploadMask: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: 80,
      height: 80,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
  }),
);
