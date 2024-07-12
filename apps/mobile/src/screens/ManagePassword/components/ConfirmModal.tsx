import { useTranslation } from 'react-i18next';
import {
  Modal,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { Button } from '@/components';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';

const LAYOUTS = {
  contentMaxWidth: 353,
  contentMaxHeight: 252,
  fixedFooterHeight: 88,
  buttonHeight: 48,
};

const getConfirmSetPasswordModalStyles = createGetStyles(colors => {
  return {
    modal: {
      // box-shadow: 0px 10px 20px 0px rgba(0, 0, 0, 0.10);
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    modalContent: {
      position: 'relative',
      borderRadius: 16,
      backgroundColor: colors['neutral-bg1'],
      width: '100%',
      maxWidth: LAYOUTS.contentMaxWidth,
      maxHeight: LAYOUTS.contentMaxHeight,
      paddingTop: 20,
      // paddingBottom: LAYOUTS.fixedFooterHeight,
      flexDirection: 'column',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors['neutral-title1'],
    },
    modalBody: {
      paddingTop: 16,
      paddingBottom: 28,
      paddingHorizontal: 20,
      // ...makeDebugBorder(),
    },
    confirmText: {
      fontSize: 16,
      fontWeight: '400',
      color: colors['neutral-body'],
    },
    modalFooter: {
      width: '100%',
      maxWidth: LAYOUTS.contentMaxWidth,
      height: LAYOUTS.fixedFooterHeight,
      paddingHorizontal: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-line'],
      // ...makeDebugBorder('red'),
    },
    fixedModalFooter: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      // ...makeDebugBorder('yellow'),
    },
    buttonGroup: {
      height: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 0,
    },
    btnItemContainer: {
      height: LAYOUTS.buttonHeight,
      flexShrink: 1,
    },
    buttonContainer: {
      borderRadius: 8,
      width: '100%',
    },
    button: {
      height: LAYOUTS.buttonHeight,
    },
    cancelStyle: {},
    confirmStyle: {},
    buttonTitle: {
      fontSize: 15,
      fontWeight: '600',
    },
    cancelTitleStyle: {},
    confirmTitleStyle: {},
    btnGap: {
      width: 13,
    },
  };
});

export function ConfirmSetPasswordModal({
  visible,
  onCancel,
  onConfirm,
  modalStyle,
  overlayStyle,
  children,
}: React.PropsWithChildren<{
  visible: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  modalStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
}>) {
  const { styles } = useThemeStyles(getConfirmSetPasswordModalStyles);
  const { t } = useTranslation();

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      visible={visible}
      style={[styles.modal, modalStyle]}>
      <View style={[styles.overlay, overlayStyle]}>
        <View style={[styles.modalContent]}>
          <Text style={[styles.modalTitle]}>
            {t('page.createPassword.confirmTitle')}
          </Text>
          <View style={[styles.modalBody]}>
            <Text style={[styles.confirmText]}>
              {t('page.createPassword.confirmModalDesc')}
            </Text>
          </View>

          <View style={[styles.modalFooter]}>
            <View style={styles.buttonGroup}>
              <View style={styles.btnItemContainer}>
                <Button
                  type="primary"
                  ghost
                  title={t('global.Cancel')}
                  onPress={onCancel}
                  buttonStyle={styles.button}
                  containerStyle={[styles.buttonContainer, styles.cancelStyle]}
                  titleStyle={[styles.buttonTitle, styles.cancelTitleStyle]}
                />
              </View>
              <View style={styles.btnGap} />
              <View style={styles.btnItemContainer}>
                <Button
                  type="primary"
                  title={t('global.Confirm')}
                  onPress={onConfirm}
                  buttonStyle={styles.button}
                  containerStyle={[styles.buttonContainer, styles.confirmStyle]}
                  titleStyle={[styles.buttonTitle, styles.confirmTitleStyle]}
                />
              </View>
            </View>
          </View>
        </View>
        {children}
      </View>
    </Modal>
  );
}
