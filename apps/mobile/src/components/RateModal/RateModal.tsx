import {
  Dimensions,
  Modal,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { RcIconLogoBlue } from '@/assets/icons/common';

import StarCC from './icons/star-cc.svg';
import { IS_ANDROID } from '@/core/native/utils';
import { NextInput } from '@/components2024/Form/Input';
import { useMemo } from 'react';
import { useRateModal } from './hooks';
import { openExternalUrl } from '@/core/utils/linking';
import { APP_URLS } from '@/constant';

const LOGO_SIZE = 67;
const STAR_SIZE = 34;

function PressableStar({
  isFilled,
  onPress,
}: {
  isFilled?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <StarCC
        width={STAR_SIZE}
        height={STAR_SIZE}
        color={isFilled ? 'rgba(255, 205, 54, 1)' : 'rgba(0, 0, 0, 0.16)'}
      />
    </TouchableWithoutFeedback>
  );
}

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
  } = useRateModal();

  const wantFeedback = useMemo(() => {
    return userStar <= 3;
  }, [userStar]);

  const userFeedbackLenIndicator = useMemo(() => {
    return `${userFeedback.length}/${300}`;
  }, [userFeedback.length]);

  return (
    <Modal
      visible={rateModalShown}
      transparent
      animationType="fade"
      style={styles.modal}>
      <View style={styles.modalMask}>
        <View style={styles.modal}>
          <View style={styles.logoWrapper}>
            <RcIconLogoBlue style={{ width: LOGO_SIZE, height: LOGO_SIZE }} />
          </View>
          <View style={styles.starsContainer}>
            {Array.from({ length: 5 }, (_, index) => {
              const rate = index + 1;
              return (
                <PressableStar
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
            <View style={styles.bottomContainer}>
              <View style={styles.descThx}>
                <Text>😄 </Text>
                <Text style={styles.descThxText}>
                  {t('page.nextComponent.rateModal.description')}
                </Text>
              </View>
              <View style={styles.rateButtonsContainer}>
                <Button
                  type="primary"
                  buttonStyle={[styles.rateButton, styles.rateButtonConfirm]}
                  titleStyle={[
                    styles.rateButtonText,
                    styles.rateButtonConfirmText,
                  ]}
                  onPress={() => {
                    openExternalUrl(APP_URLS.RATE_URL);
                  }}
                  title={
                    IS_ANDROID
                      ? t(
                          'page.nextComponent.rateModal.confirmButtonTitleAndroid',
                        )
                      : t('page.nextComponent.rateModal.confirmButtonTitleIOS')
                  }
                />
                <Button
                  type="ghost"
                  buttonStyle={[styles.rateButton, styles.rateButtonCancel]}
                  titleStyle={[
                    styles.rateButtonText,
                    styles.rateButtonCancelText,
                  ]}
                  onPress={() => {
                    toggleShowRateModal(false);
                  }}
                  title={t('global.Cancel')}
                />
              </View>
            </View>
          ) : (
            <View style={styles.bottomContainer}>
              <View style={styles.feedbackTopContainer}>
                <Text style={styles.feedbackText}>
                  {t('page.nextComponent.rateModal.feedbackTitle')}
                </Text>
                <View style={styles.inputContainer}>
                  <NextInput.TextArea
                    inputProps={{
                      value: userFeedback,
                      onChangeText(text) {
                        onChangeFeedback(text);
                      },
                    }}
                  />
                  <Text style={styles.inputTextLenIndicator}>
                    {userFeedbackLenIndicator}
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
                    toggleShowRateModal(false);
                  }}
                  title={t('global.Cancel')}
                />
                <Button
                  type="primary"
                  containerStyle={styles.feedbackButtonContainer}
                  buttonStyle={[
                    styles.feedbackButton,
                    styles.feedbackButtonConfirm,
                  ]}
                  titleStyle={[
                    styles.feedbackButtonText,
                    styles.feedbackButtonConfirmText,
                  ]}
                  onPress={() => {}}
                  title={t('page.nextComponent.rateModal.feedbackSubmit')}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const MODAL_H_PADDING = 20;

const getStyles = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {},
    modalMask: {
      backgroundColor: 'rgba(0,0,0,0.4)',
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

    bottomContainer: {
      marginBottom: 14,
      width: '100%',
    },

    descThx: {
      flexDirection: 'row',
      maxWidth: '100%',
      overflow: 'hidden',
      marginBottom: 21,
      // ...makeDebugBorder(),
    },
    descThxText: {
      color: colors2024['neutral-black'],
      fontFamily: 'SF Pro',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 20,
      justifyContent: 'center',
      flexWrap: 'wrap',
      flexShrink: 1,
    },
    rateButtonsContainer: {
      borderTopColor: colors2024['neutral-line'],
      borderTopWidth: 0,
      flexDirection: 'column',
      gap: 13,
      justifyContent: 'space-between',
      width: '100%',
    },
    rateButtonText: {
      fontSize: 20,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 24,
    },
    rateButton: {
      width: '100%',
      height: 56,
      borderRadius: 8,
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

    feedbackTopContainer: {
      width: '100%',
    },
    feedbackText: {
      marginBottom: 20,
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro',
      fontSize: 20,
      fontStyle: 'normal',
      fontWeight: 700,
      lineHeight: 24,
      justifyContent: 'center',
      textAlign: 'center',
      flexWrap: 'nowrap',
      width: '100%',
      // ...makeDebugBorder(),
    },
    inputContainer: {
      position: 'relative',
    },
    inputTextLenIndicator: {
      position: 'absolute',
      bottom: 12,
      right: 12,
      backgroundColor: 'transparent',
      color: colors2024['neutral-secondary'],
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: 400,
      lineHeight: 22,
    },
    feedbackButtonsContainer: {
      marginTop: 46,
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
      fontSize: 20,
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
      borderColor: colors2024['blue-default'],
      borderWidth: 1,
    },
    feedbackButtonCancelText: {
      color: colors2024['blue-default'],
    },
  };
});
