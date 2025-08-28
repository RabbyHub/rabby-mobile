import { useTranslation } from 'react-i18next';
import { Dimensions, Modal, Text, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';

import { useSubmitSuccessModalVisible } from './hooks';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Button } from '@/components2024/Button';
import { FontWeightEnum } from '@/core/utils/fonts';

import RcSuccessCC from './icons/success-cc.svg';

export function SubmitSuccessModal() {
  const { t } = useTranslation();

  const { styles, colors2024 } = useTheme2024({ getStyle: getModalStyle });

  const { submitSuccessModalVisible, closeSubmitSuccessModal } =
    useSubmitSuccessModalVisible();

  return (
    <Modal
      visible={submitSuccessModalVisible}
      transparent
      animationType="fade"
      style={styles.modalComp}>
      <View style={[styles.modalMask, styles.maskBg]}>
        <View style={[styles.modalWrapper]}>
          <View style={[styles.modal]}>
            <View style={styles.modalContent}>
              <View style={styles.topArea}>
                <View style={styles.iconWrapper}>
                  <RcSuccessCC
                    style={styles.successIcon}
                    color={colors2024['neutral-InvertHighlight']}
                  />
                </View>
                <View style={styles.descWrapper}>
                  <Text style={styles.desc}>
                    {t('component.submitFeedbackSuccessModal.desc')}
                  </Text>
                </View>
              </View>
              {/* Submit Area */}
              <View style={styles.submitArea}>
                <Button
                  title={t('global.ok')}
                  containerStyle={styles.okButtonContainer}
                  buttonStyle={styles.okButton}
                  titleStyle={styles.okButtonTitle}
                  type="primary"
                  onPress={() => {
                    closeSubmitSuccessModal();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const SIZES = {
  MODAL_MASK_H_PADDING: 20,
  MODAL_PADDING: 20,
};
const getModalStyle = createGetStyles2024(({ isLight, colors2024 }) => {
  const winLayout = Dimensions.get('window');
  const modalWidth = winLayout.width - SIZES.MODAL_MASK_H_PADDING * 2;

  return {
    modalComp: {},
    maskBg: {
      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.85)',
    },
    modalMask: {
      position: 'relative',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SIZES.MODAL_MASK_H_PADDING,
      height: winLayout.height,
      width: winLayout.width,
    },
    modalWrapper: {
      width: '100%',
      height: 246,
      minHeight: 246,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    modal: {
      maxWidth: modalWidth,
      width: '100%',
      height: '100%',
      padding: SIZES.MODAL_PADDING,
      backgroundColor: colors2024['neutral-bg-1'],
      borderRadius: 20,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalContent: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      // ...makeDebugBorder('red'),
    },
    topArea: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 22,
      // ...makeDebugBorder(),
    },
    iconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 64,
      marginBottom: 16,
      backgroundColor: colors2024['green-light-4'],
      justifyContent: 'center',
      alignItems: 'center',
    },
    successIcon: {
      width: 48,
      height: 48,
    },
    descWrapper: {
      justifyContent: 'center',
      alignItems: 'center',
      // ...makeDebugBorder('red'),
    },
    desc: {
      fontSize: 20,
      fontFamily: 'SF Pro Rounded',
      lineHeight: 24,
      fontWeight: FontWeightEnum.bold,
      color: colors2024['neutral-title-1'],
    },
    submitArea: {
      position: 'relative',
      width: '100%',
    },
    okButtonContainer: {
      height: 56,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    okButton: {
      height: 56,
    },
    okButtonTitle: {
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
