import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSubmitFeedbackOnScreenshot } from './hooks';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';

import { Button } from '@/components2024/Button';
import { FontWeightEnum } from '@/core/utils/fonts';
import ModalInput from './ModalInput';
import { toast } from '@/components2024/Toast';

import { ICONS_COMMON_2024 } from '@/assets2024/icons/common';

function SwitchTextLine({
  checked,
  onChange,
  style,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
} & RNViewProps) {
  const { styles } = useTheme2024({ getStyle: getSwitchLineStyle });
  const { t } = useTranslation();

  const IconComp = checked
    ? ICONS_COMMON_2024.RcCheckboxFilledBrand
    : ICONS_COMMON_2024.RcCheckboxEmpty;

  return (
    <View style={[styles.switchArea, style]}>
      <TouchableOpacity
        activeOpacity={0.5}
        style={styles.switchPressable}
        onPress={() => onChange(!checked)}>
        <IconComp style={{ marginRight: 4 }} width={24} height={24} />
        <Text style={styles.skipText}>
          {t('component.screenshotModal.switchArea.skipText')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const getSwitchLineStyle = createGetStyles2024(ctx => {
  return {
    switchArea: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    switchPressable: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      // ...makeDebugBorder(),
    },
    skipCheckbox: {
      width: 24,
      height: 24,
    },
    skipText: {
      color: ctx.isLight ? '#9A9CA9' : ctx.colors2024['neutral-info'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontStyle: 'normal',
      fontWeight: 500,
      lineHeight: 16,
    },
  };
});

// const IMAGE_CONTAIN_STYLE = { height: 200, width: '100%' } as const;
const IMAGE_RESIZE_MODE = 'cover' as const;

function wrapOnPress(handler?: (evt: GestureResponderEvent) => void) {
  return (evt: GestureResponderEvent) => {
    evt.stopPropagation();
    return handler?.(evt);
  };
}

export function ModalsSubmitFeedbackByScreenshotStub() {
  const { styles } = useTheme2024({ getStyle: getModalStyle });
  const { t } = useTranslation();

  const {
    lastScreenshot,
    globalModalShown,
    closeSubmitModal,
    isSubmitting,
    submitFeedbackByScreenshot,
    canSubmitFeedback,
  } = useSubmitFeedbackOnScreenshot();

  const [skipInNext1Day, setSkipInNext1Day] = useState(false);

  useEffect(() => {
    if (globalModalShown) {
      setSkipInNext1Day(false);
    }
  }, [globalModalShown]);

  if (!globalModalShown) {
    return null;
  }

  return (
    <Modal
      visible={globalModalShown}
      transparent
      animationType="fade"
      style={styles.modalComp}>
      <View style={[styles.maskExtra, styles.maskBg]} />

      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : 'padding'}
        style={[{ flex: 1 }]}>
        <TouchableOpacity
          style={[styles.avoidingView, IS_ANDROID && styles.maskBg]}
          activeOpacity={1}
          onPress={() => {
            if (Keyboard.isVisible()) {
              Keyboard.dismiss();
            } else {
              closeSubmitModal({ skipInNext1Day });
            }
          }}>
          <View style={[styles.modalWrapper]}>
            <TouchableOpacity
              style={[styles.modal]}
              activeOpacity={1}
              onPress={wrapOnPress(() => {
                Keyboard.dismiss();
              })}>
              <View style={styles.modalContent}>
                <View style={styles.titleWrapper}>
                  <Text style={styles.title}>
                    {t('component.screenshotModal.title')}
                  </Text>
                </View>
                <View style={[styles.imageWrapper]}>
                  {lastScreenshot?.uri && (
                    <Image
                      style={[styles.image, { width: '100%', height: '100%' }]}
                      source={{ uri: lastScreenshot.uri }}
                      resizeMode={IMAGE_RESIZE_MODE}
                    />
                  )}
                </View>
                {/* Submit Area */}
                <View style={styles.submitArea}>
                  <ModalInput style={[]} />
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
                      // loading={isSubmitting}
                      loadingStyle={styles.buttonLoading}
                      onPress={wrapOnPress(() => {
                        closeSubmitModal({ skipInNext1Day });
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
                      disabled={isSubmitting || !canSubmitFeedback}
                      // loading={isSubmitting}
                      loadingStyle={styles.buttonLoading}
                      onPress={wrapOnPress(evt => {
                        submitFeedbackByScreenshot();
                        setTimeout(() => {
                          closeSubmitModal({
                            skipInNext1Day,
                            clearText: true,
                          });
                          toast.success(
                            t('component.submitFeedbackSuccessModal.desc'),
                            {
                              duration: 3000,
                              hideOnPress: true,
                            },
                          );
                        }, 300);
                      })}
                    />
                  </View>
                  <SwitchTextLine
                    checked={skipInNext1Day}
                    onChange={nextVal => {
                      setSkipInNext1Day(nextVal);
                    }}
                    style={[]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const SIZES = {
  MODAL_MASK_H_PADDING: 20,
  MODAL_V_MARGIN: 97,
  MODAL_H_PADDING: 20,
  MODAL_MIN_H: 450,

  IMG_MAX_H: 450,
  IMG_MAX_W: 321,

  EDIT_ICON_WRAPPER_SIZE: 60,
};
// function getEditPenIconLeftValue(
//   imageWrapperW = SIZES.IMG_MAX_W,
//   editIconWrapperW = SIZES.EDIT_ICON_WRAPPER_SIZE,
// ) {
//   return (imageWrapperW - editIconWrapperW) / 2;
// }
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
      // maxWidth: SIZES.IMG_MAX_W,
      maxHeight: SIZES.IMG_MAX_H,
      borderRadius: 21,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors2024['neutral-line'],
      flex: 1,
      marginTop: 16,
      marginBottom: 16,
      // ...makeDebugBorder(),
    },
    image: IS_IOS ? { borderRadius: 21 } : {},
    submitArea: {
      position: 'relative',
      width: '100%',
      gap: 16,
      // ...makeDebugBorder('yellow'),
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
  };
});
