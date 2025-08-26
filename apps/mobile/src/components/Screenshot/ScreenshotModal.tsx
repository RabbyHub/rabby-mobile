import React from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Image,
  KeyboardAvoidingView,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { useLastScreenshot, useResize } from '@/hooks/native/security';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSubmitFeedbackOnScreenshot } from './hooks';
import { IS_IOS } from '@/core/native/utils';

import RcCloseCC from './icons/close-cc.svg';
import RcEditCC from './icons/edit-cc.svg';
import { Button } from '@/components2024/Button';
import { useTranslation } from 'react-i18next';
import { FontWeightEnum } from '@/core/utils/fonts';
import ModalBottomInput, { BottomInputMethods } from './ModalBottomInput';
import TouchableView from '../Touchable/TouchableView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useOnKeyboardDismissed } from '@/hooks/system/keyboard';

// const IMAGE_CONTAIN_STYLE = { height: 200, width: '100%' } as const;
const IMAGE_RESIZE_MODE = 'contain' as const;

function wrapOnPress(handler?: (evt: GestureResponderEvent) => void) {
  return (evt: GestureResponderEvent) => {
    evt.stopPropagation();
    return handler?.(evt);
  };
}

export function GlobalModalSubmitFeedbackWithScreenshot() {
  const { lastScreenshot } = useLastScreenshot();
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle: getModalStyle });
  const { scaledSize } = useResize(lastScreenshot, {
    maxHeight: SIZES.IMG_MAX_H,
    maxWidth: SIZES.IMG_MAX_W,
  });
  console.debug('[debug] scaledSize', scaledSize);
  console.debug('[debug] lastScreenshot?.uri', lastScreenshot?.uri);

  const { globalModalShown, feedbackText } = useSubmitFeedbackOnScreenshot();
  // const bottomInputRef = React.useRef<BottomInputMethods>(null);
  const [bottomInputVisible, setBottomInputVisible] = React.useState(false);

  const [editIconParentLayout, setEditIconParentLayout] = React.useState({
    width: 0,
  });

  useOnKeyboardDismissed(() => {
    setBottomInputVisible(false);
  });

  if (!lastScreenshot?.uri) {
    return null;
  }

  return (
    <Modal
      visible={globalModalShown}
      transparent
      animationType="fade"
      style={styles.modalComp}>
      <TouchableOpacity
        style={[styles.modalMask]}
        activeOpacity={1}
        onPress={() => {
          setBottomInputVisible(false);
        }}>
        <KeyboardAvoidingView
          behavior={IS_IOS ? 'padding' : 'padding'}
          style={styles.modalWrapper}>
          <View style={[styles.modal]}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={wrapOnPress(evt => {})}>
              <RcCloseCC
                style={styles.modalCloseIcon}
                color={styles.modalCloseIcon.color}
              />
            </TouchableOpacity>
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
                <Image
                  style={[styles.image, { width: '100%', height: '100%' }]}
                  source={{ uri: lastScreenshot.uri }}
                  resizeMode={IMAGE_RESIZE_MODE}
                />
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
                  <View style={styles.feedbackPreview}>
                    <Text
                      style={styles.feedbackPreviewText}
                      numberOfLines={1}
                      lineBreakMode="clip">
                      <Text style={{ fontWeight: 'bold' }}>
                        {t('component.screenshotModal.feedbackLabel')}{' '}
                      </Text>
                      {feedbackText.slice(0, 300)}
                    </Text>
                  </View>
                )}
                <Button
                  title={t('component.screenshotModal.submitButtonText')}
                  containerStyle={styles.submitButtonContainer}
                  buttonStyle={styles.submitButton}
                  titleStyle={styles.buttonTitle}
                  type="primary"
                  onPress={wrapOnPress(evt => {})}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableOpacity>

      <ModalBottomInput
        visible={bottomInputVisible}
        // ref={bottomInputRef}
      />
    </Modal>
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
    modalMask: {
      position: 'relative',
      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.85)',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SIZES.MODAL_MASK_H_PADDING,
      height: winLayout.height,
    },
    modalWrapper: {
      width: '100%',
      height: winLayout.height - SIZES.MODAL_V_MARGIN * 2,
      minHeight: winLayout.height - SIZES.MODAL_V_MARGIN * 2,
      justifyContent: 'center',
      alignItems: 'center',
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
      color: colors2024['neutral-black'],
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
      fontWeight: FontWeightEnum.extraBold,
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
    image: {},
    editIconWrapper: {
      position: 'absolute',
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
    submitButtonContainer: {
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    submitButton: {
      height: 56,
    },
    buttonTitle: {
      width: '100%',
      // height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // flexShrink: 0,
      // ...makeDebugBorder('yellow')
    },
  };
});
