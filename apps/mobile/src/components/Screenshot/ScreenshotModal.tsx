import React, { useCallback } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Image,
  KeyboardAvoidingView,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSubmitFeedbackOnScreenshot } from './hooks';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';

// import RcCloseCC from './icons/close-cc.svg';
import RcEditCC from './icons/edit-cc.svg';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { FontWeightEnum } from '@/core/utils/fonts';
import ModalBottomInput from './ModalBottomInput';
import { useOnKeyboardDismissed } from '@/hooks/system/keyboard';
import { SubmitSuccessModal } from './SubmitSuccessModal';

// const IMAGE_CONTAIN_STYLE = { height: 200, width: '100%' } as const;
const IMAGE_RESIZE_MODE = 'cover' as const;

function wrapOnPress(handler?: (evt: GestureResponderEvent) => void) {
  return (evt: GestureResponderEvent) => {
    evt.stopPropagation();
    return handler?.(evt);
  };
}

export function ModalsSubmitFeedbackByScreenshotStub() {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getModalStyle });

  const {
    lastScreenshot,
    globalModalShown,
    closeSubmitModal,
    feedbackText,
    isSubmitting,
    submitFeedbackByScreenshot,
    canSubmitFeedback,
  } = useSubmitFeedbackOnScreenshot();

  const [bottomInputVisible, setBottomInputVisible] = React.useState(false);

  const [editIconParentLayout, setEditIconParentLayout] = React.useState({
    width: 0,
  });

  useOnKeyboardDismissed(
    useCallback(() => {
      setBottomInputVisible(false);
    }, []),
  );

  return (
    <>
      <SubmitSuccessModal />

      <Modal
        visible={globalModalShown}
        transparent
        animationType="fade"
        style={styles.modalComp}>
        <View
          style={[styles.maskExtra, !bottomInputVisible && styles.maskBg]}
        />

        <KeyboardAvoidingView
          behavior={IS_IOS ? 'padding' : 'padding'}
          style={[{ flex: 1 }]}>
          <TouchableOpacity
            style={[
              styles.avoidingView,
              (bottomInputVisible || IS_ANDROID) && styles.maskBg,
              bottomInputVisible && { flexShrink: 0 },
            ]}
            activeOpacity={1}
            onPress={() => {
              if (bottomInputVisible) {
                setBottomInputVisible(false);
              } else {
                closeSubmitModal();
              }
            }}>
            <View style={[styles.modalWrapper]}>
              <TouchableOpacity
                style={[styles.modal]}
                activeOpacity={1}
                onPress={wrapOnPress(() => {
                  setBottomInputVisible(false);
                })}>
                {/* <TouchableOpacity
                  style={styles.modalClose}
                  onPress={wrapOnPress(() => {
                    closeSubmitModal();
                  })}>
                  <RcCloseCC
                    style={styles.modalCloseIcon}
                    color={styles.modalCloseIcon.color}
                  />
                </TouchableOpacity> */}
                <View style={styles.modalContent}>
                  <View style={styles.titleWrapper}>
                    <Text style={styles.title}>
                      {t('component.screenshotModal.title')}
                    </Text>
                  </View>
                  <View
                    style={[styles.imageWrapper]}
                    onLayout={event => {
                      const { width } = event.nativeEvent.layout;
                      setEditIconParentLayout({ width });
                    }}>
                    {lastScreenshot?.uri && (
                      <Image
                        style={[
                          styles.image,
                          { width: '100%', height: '100%' },
                        ]}
                        source={{ uri: lastScreenshot.uri }}
                        resizeMode={IMAGE_RESIZE_MODE}
                      />
                    )}
                    {/* Edit pen icon */}
                    <TouchableOpacity
                      style={[
                        styles.editIconWrapper,
                        !editIconParentLayout.width
                          ? {}
                          : {
                              left: getEditPenIconLeftValue(
                                editIconParentLayout.width,
                              ),
                            },
                      ]}
                      onPress={wrapOnPress(evt => {
                        setBottomInputVisible(true);
                      })}>
                      <RcEditCC
                        style={styles.editIcon}
                        color={styles.editIcon.color}
                      />
                    </TouchableOpacity>
                  </View>
                  {/* Submit Area */}
                  <View style={styles.submitArea}>
                    {!!feedbackText && (
                      <TouchableOpacity
                        style={styles.feedbackPreview}
                        onPress={wrapOnPress(evt => {
                          setBottomInputVisible(true);
                        })}>
                        <Text
                          style={styles.feedbackPreviewText}
                          numberOfLines={1}
                          lineBreakMode="clip">
                          <Text style={{ fontWeight: 'bold' }}>
                            {t('component.screenshotModal.feedbackLabel')}{' '}
                          </Text>
                          {feedbackText.slice(0, 300)}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.buttonGroup}>
                      <Button
                        title={t('global.cancel')}
                        containerStyle={[
                          styles.buttonContainer,
                          styles.cancelButtonContainer,
                        ]}
                        buttonStyle={[
                          styles.buttonStyle,
                          styles.cancelButtonStyle,
                        ]}
                        titleStyle={[
                          styles.buttonTitle,
                          styles.cancelButtonTitle,
                        ]}
                        type="ghost"
                        disabled={isSubmitting}
                        loading={isSubmitting}
                        loadingStyle={styles.buttonLoading}
                        onPress={wrapOnPress(() => {
                          closeSubmitModal();
                        })}
                      />
                      <Button
                        title={t('component.screenshotModal.submitButtonText')}
                        containerStyle={[
                          styles.buttonContainer,
                          styles.submitButtonContainer,
                        ]}
                        buttonStyle={[
                          styles.buttonStyle,
                          styles.submitButtonStyle,
                        ]}
                        titleStyle={[
                          styles.buttonTitle,
                          styles.submitButtonTitle,
                        ]}
                        type="primary"
                        disabled={!canSubmitFeedback || bottomInputVisible}
                        loading={isSubmitting}
                        loadingStyle={styles.buttonLoading}
                        onPress={wrapOnPress(evt => {
                          submitFeedbackByScreenshot();
                        })}
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {IS_IOS && (
            <ModalBottomInput
              visible={bottomInputVisible}
              style={[!bottomInputVisible && styles.leaveDocumentFlow]}
            />
          )}
        </KeyboardAvoidingView>
        {IS_ANDROID && (
          <ModalBottomInput
            visible={bottomInputVisible}
            style={[!bottomInputVisible && styles.leaveDocumentFlow]}
          />
        )}
      </Modal>
    </>
  );
}

const SIZES = {
  MODAL_MASK_H_PADDING: 20,
  MODAL_V_MARGIN: 97,
  MODAL_H_PADDING: 20,
  MODAL_MIN_H: 450,

  IMG_MAX_H: 450,
  IMG_MAX_W: 230,

  EDIT_ICON_WRAPPER_SIZE: 60,
};
function getEditPenIconLeftValue(
  imageWrapperW = SIZES.IMG_MAX_W,
  editIconWrapperW = SIZES.EDIT_ICON_WRAPPER_SIZE,
) {
  return (imageWrapperW - editIconWrapperW) / 2;
}
const getModalStyle = createGetStyles2024(({ isLight, colors2024 }) => {
  const winLayout = Dimensions.get('window');
  const modalWidth = winLayout.width - SIZES.MODAL_MASK_H_PADDING * 2;

  return {
    modalComp: {},
    maskBg: {
      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.85)',
    },
    avoidingView: {
      position: 'relative',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SIZES.MODAL_MASK_H_PADDING,
      height: winLayout.height,
      width: winLayout.width,
    },
    maskExtra: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      // backgroundColor: 'red',
      height: winLayout.height,
    },
    modalWrapper: {
      width: '100%',
      height: winLayout.height - SIZES.MODAL_V_MARGIN * 2,
      minHeight: winLayout.height - SIZES.MODAL_V_MARGIN * 2,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    modal: {
      maxWidth: modalWidth,
      width: '100%',
      height: '100%',
      paddingTop: 30,
      paddingBottom: 30,
      backgroundColor: colors2024['neutral-bg-1'],
      borderRadius: 20,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalContent: {
      width: '100%',
      height: '100%',
      paddingHorizontal: SIZES.MODAL_H_PADDING,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalClose: {
      position: 'absolute',
      top: 0,
      paddingTop: 16,
      right: 0,
      paddingRight: 16,
      // ...makeDebugBorder('green'),
    },
    modalCloseIcon: {
      width: 30,
      height: 30,
      color: isLight
        ? colors2024['neutral-black']
        : colors2024['neutral-InvertHighlight'],
    },
    titleWrapper: {
      justifyContent: 'center',
      alignItems: 'center',
      // ...makeDebugBorder('red'),
    },
    title: {
      fontSize: 20,
      fontFamily: 'SF Pro Rounded',
      lineHeight: 24,
      fontWeight: FontWeightEnum.heavy,
      color: colors2024['neutral-title-1'],
    },
    imageWrapper: {
      position: 'relative',
      width: '100%',
      maxWidth: SIZES.IMG_MAX_W,
      maxHeight: SIZES.IMG_MAX_H,
      borderRadius: 21,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors2024['neutral-line'],
      flex: 1,
      marginTop: 30,
      marginBottom: 30,
      // ...makeDebugBorder(),
    },
    image: IS_IOS ? { borderRadius: 21 } : {},
    editIconWrapper: {
      position: 'absolute',
      zIndex: 9,
      // top: 17,
      bottom: -14,
      left: getEditPenIconLeftValue(),
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      height: SIZES.EDIT_ICON_WRAPPER_SIZE,
      width: SIZES.EDIT_ICON_WRAPPER_SIZE,
      borderRadius: SIZES.EDIT_ICON_WRAPPER_SIZE,
      borderWidth: 1,
      borderStyle: 'solid',
      shadowOpacity: 1,
      shadowRadius: SIZES.EDIT_ICON_WRAPPER_SIZE,
      elevation: 10,
      ...(isLight
        ? {
            borderColor: colors2024['neutral-bg-1'],
            // backgroundColor: 'rgba(255, 255, 255, 0.80)',
            backgroundColor: colors2024['neutral-bg-1'],
            shadowColor: 'rgba(0, 0, 0, 0.20)',
            shadowOffset: {
              width: 0,
              height: 24,
            },
          }
        : {
            borderWidth: 2,
            borderColor: colors2024['neutral-bg-2'],
            backgroundColor: colors2024['neutral-bg-1'],
            shadowColor: '#fff',
            shadowOffset: {
              width: 0,
              height: 13,
            },
          }),
    },
    editIcon: {
      color: colors2024['neutral-body'],
      height: 35,
      width: 35,
    },
    submitArea: {
      position: 'relative',
      width: '100%',
    },
    feedbackPreview: {
      padding: 9,
      borderRadius: 6,
      backgroundColor: colors2024['neutral-bg-5'],
      marginHorizontal: 17,
      marginBottom: 16,
    },
    feedbackPreviewText: {
      color: colors2024['neutral-foot'],
      fontSize: 12,
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      lineHeight: 16,
    },
    buttonGroup: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    buttonContainer: {
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      flexShrink: 1,
    },
    buttonTitle: {
      width: '100%',
      // height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLoading: {
      width: '100%',
    },
    buttonStyle: {
      height: 56,
    },
    cancelButtonContainer: {
      // backgroundColor: colors2024['neutral-bg-5'],
    },
    cancelButtonTitle: {
      color: colors2024['neutral-body'],
    },
    cancelButtonStyle: {
      backgroundColor: colors2024['neutral-bg-5'],
      borderWidth: 0,
    },
    submitButtonContainer: {},
    submitButtonTitle: {},
    submitButtonStyle: {},

    leaveDocumentFlow: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
  };
});
