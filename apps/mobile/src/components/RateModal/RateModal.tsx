import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { RcIconLogoBlueAutoSize } from '@/assets/icons/common';

import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { NextInput } from '@/components2024/Form/Input';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FEEDBACK_LEN_LIMIT,
  useExposureRateGuide,
  useRateModal,
} from './hooks';
import { toast } from '@/components2024/Toast';
import PressableStar from './RateStar';

const LOGO_SIZE = 67;

export function RateModal() {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const {
    rateModalShown,
    toggleShowRateModal,

    userStar,
    selectStar,

    userFeedback,
    onChangeFeedback,
    isSubmitting,
    pushRateDetails,
    feedbackOverLimit,

    openAppRateUrl,
  } = useRateModal();

  const closeModal = useCallback(() => {
    toggleShowRateModal(false, {
      disableExposureOnClose: true,
    });
  }, [toggleShowRateModal]);

  const wantFeedback = useMemo(() => {
    return userStar <= 3;
  }, [userStar]);

  // const inputRef = useRef<TextInput>(null);
  // useEffect(() => {
  //   if (rateModalShown && wantFeedback) {
  //     inputRef.current?.focus();
  //     setTimeout(() => inputRef.current?.focus(), 150);
  //     // show keyboard when modal is shown
  //     // TODO:
  //   }
  // }, [rateModalShown, wantFeedback]);

  const disableSubmit = useMemo(() => {
    return !wantFeedback || !userFeedback.length;
  }, [wantFeedback, userFeedback]);

  return (
    <Modal
      visible={rateModalShown}
      transparent
      animationType="fade"
      style={styles.modalComp}>
      <View style={styles.modalMask}>
        <KeyboardAvoidingView behavior={IS_IOS ? 'padding' : 'height'}>
          <View
            style={[
              styles.modal,
              wantFeedback ? { paddingBottom: 24 } : { paddingBottom: 13 },
            ]}>
            <View style={styles.logoWrapper}>
              <RcIconLogoBlueAutoSize width={LOGO_SIZE} height={LOGO_SIZE} />
            </View>
            <View style={styles.starsContainer}>
              {Array.from({ length: 5 }, (_, index) => {
                const rate = index + 1;
                return (
                  <PressableStar
                    disabled
                    style={styles.star}
                    key={`star-${index}`}
                    isFilled={userStar >= rate}
                    onPress={() => {
                      selectStar(rate);
                    }}
                  />
                );
              })}
            </View>
            {!wantFeedback ? (
              <View style={[styles.bottomContainer]}>
                <View style={styles.descThx}>
                  <Text style={styles.descThxText}>
                    <Text style={[styles.descThxText, styles.descThxTextEmoji]}>
                      😄{' '}
                    </Text>
                    {IS_ANDROID
                      ? t('page.nextComponent.rateModal.descriptionAndroid')
                      : t('page.nextComponent.rateModal.descriptionIOS')}
                  </Text>
                </View>
                <View style={styles.rateButtonsContainer}>
                  <Button
                    type="primary"
                    loading={isSubmitting}
                    containerStyle={styles.rateButtonContainer}
                    buttonStyle={[styles.rateButton, styles.rateButtonConfirm]}
                    titleStyle={[
                      styles.rateButtonText,
                      styles.rateButtonConfirmText,
                    ]}
                    onPress={() => {
                      openAppRateUrl();
                      pushRateDetails().finally(() => {
                        closeModal();
                      });
                    }}
                    title={
                      IS_ANDROID
                        ? t(
                            'page.nextComponent.rateModal.confirmButtonTitleAndroid',
                          )
                        : t(
                            'page.nextComponent.rateModal.confirmButtonTitleIOS',
                          )
                    }
                  />
                  <Button
                    type="ghost"
                    containerStyle={styles.rateButtonContainer}
                    buttonStyle={[styles.rateButton, styles.rateButtonCancel]}
                    titleStyle={[
                      styles.rateButtonText,
                      styles.rateButtonCancelText,
                    ]}
                    onPress={() => {
                      closeModal();
                    }}
                    title={t('global.Cancel')}
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.bottomContainer]}>
                <View style={styles.feedbackTextWrapper}>
                  <Text style={styles.feedbackText}>
                    {t('page.nextComponent.rateModal.feedbackTitle')}
                  </Text>
                </View>
                <View style={styles.feedbackInputContainer}>
                  <View style={styles.inputContainer}>
                    <NextInput.TextArea
                      // ref={inputRef}
                      style={{ borderColor: 'transparent' }}
                      inputStyle={styles.inputStyle}
                      inputProps={{
                        autoFocus: true,
                        blurOnSubmit: true,
                        keyboardType: 'default',
                        spellCheck: false,
                        textAlign: 'left',
                        value: userFeedback,
                        onChangeText: text => {
                          onChangeFeedback(text);
                        },
                      }}
                    />
                    <Text style={styles.inputTextLenIndicator}>
                      <Text
                        style={[
                          feedbackOverLimit && styles.inputTextOverLimit,
                        ]}>
                        {userFeedback.length}
                      </Text>
                      {`/${FEEDBACK_LEN_LIMIT - 1}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.feedbackButtonsContainer}>
                  <Button
                    type="ghost"
                    containerStyle={styles.feedbackButtonContainer}
                    buttonStyle={[
                      styles.feedbackButton,
                      styles.feedbackButtonCancel,
                    ]}
                    titleStyle={[
                      styles.feedbackButtonText,
                      styles.feedbackButtonCancelText,
                    ]}
                    onPress={() => {
                      closeModal();
                    }}
                    title={t('global.Cancel')}
                  />
                  <Button
                    type="primary"
                    loading={isSubmitting}
                    disabled={disableSubmit}
                    containerStyle={styles.feedbackButtonContainer}
                    buttonStyle={[
                      styles.feedbackButton,
                      styles.feedbackButtonConfirm,
                    ]}
                    titleStyle={[
                      styles.feedbackButtonText,
                      styles.feedbackButtonConfirmText,
                    ]}
                    onPress={() => {
                      pushRateDetails()
                        .then(() => {
                          toast.success(
                            t('page.nextComponent.rateModal.feedbackSuccess'),
                          );
                        })
                        .finally(() => {
                          closeModal();
                        });
                    }}
                    title={t('page.nextComponent.rateModal.feedbackSubmit')}
                  />
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const MODAL_H_PADDING = 20;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    modalComp: {},
    modalMask: {
      position: 'relative',
      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.85)',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: MODAL_H_PADDING,
    },
    modal: {
      maxWidth: Dimensions.get('window').width - MODAL_H_PADDING * 2,
      width: '100%',
      paddingTop: 21,
      paddingBottom: 13,
      paddingHorizontal: 24,
      backgroundColor: colors2024['neutral-bg-1'],
      borderRadius: 20,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalWithFeedback: {
      paddingBottom: 24,
    },
    logoWrapper: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 12,
      gap: 15,
    },
    star: {
      // ...makeDebugBorder(),
    },

    bottomContainer: {
      width: '100%',
      minWidth: '100%',
      // ...makeDebugBorder('red'),
    },

    descThx: {
      // flexDirection: 'row',
      maxWidth: '100%',
      overflow: 'hidden',
      marginBottom: 21,
      justifyContent: 'center',
      // ...makeDebugBorder(),
    },
    descThxText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 20,
      justifyContent: 'center',
      textAlign: 'center',
      flexWrap: 'wrap',
      flexShrink: 1,
    },
    descThxTextEmoji: {
      lineHeight: 24,
    },
    rateButtonsContainer: {
      borderTopColor: colors2024['neutral-line'],
      borderTopWidth: 0,
      flexDirection: 'column',
      gap: 13,
      justifyContent: 'space-between',
      width: '100%',
      minWidth: '100%',
      // ...makeDebugBorder(),
    },
    rateButtonContainer: {
      shadowColor: colors2024['blue-default'],
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.1,
      shadowRadius: 24,
    },
    rateButton: {
      width: '100%',
      height: 56,
      borderRadius: 12,
    },
    rateButtonText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 24,
    },
    rateButtonConfirm: {},
    rateButtonConfirmText: {
      color: colors2024['neutral-InvertHighlight'],
    },
    rateButtonCancel: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 1,
    },
    rateButtonCancelText: {
      color: '#808187',
    },

    feedbackInputContainer: {
      width: '100%',
      // ...makeDebugBorder('red'),
    },
    feedbackTextWrapper: {
      width: '100%',
      minWidth: '100%', // ensure it takes full width under KeyboardAvoidingView
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      // ...makeDebugBorder(),
    },
    feedbackText: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 24,
      justifyContent: 'center',
      textAlign: 'center',
      flexWrap: 'nowrap',
    },
    inputContainer: {
      position: 'relative',
    },
    inputStyle: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inputTextLenIndicator: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'transparent',
      color: colors2024['neutral-secondary'],
      fontSize: 15,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: 22,
    },
    inputTextOverLimit: {
      color: colors2024['red-default'],
    },
    feedbackButtonsContainer: {
      marginTop: 20,
      marginBottom: 0,
      borderTopColor: colors2024['neutral-line'],
      borderTopWidth: 0,
      flexDirection: 'row',
      gap: 13,
      justifyContent: 'center',
      width: '100%',
      // ...makeDebugBorder()
    },
    feedbackButtonContainer: {
      flexShrink: 1,
      maxWidth: '100%',
      width: 150,
    },
    feedbackButton: {
      height: 56,
      borderRadius: 12,
    },
    feedbackButtonText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 18,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 24,
    },
    feedbackButtonConfirm: {},
    feedbackButtonConfirmText: {
      color: colors2024['neutral-InvertHighlight'],
    },
    feedbackButtonCancel: {
      backgroundColor: 'transparent',
      borderColor: colors2024['brand-default'],
      borderWidth: 1,
    },
    feedbackButtonCancelText: {
      color: colors2024['brand-default'],
    },
  };
});
