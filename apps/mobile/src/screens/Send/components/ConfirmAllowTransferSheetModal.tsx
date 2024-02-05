import { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';

import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetModalConfirmContainer } from '@/components/customized/BottomSheetModalConfirmContainer';

import { useWhitelist } from '@/hooks/whitelist';
import { useSheetModal } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { RcIconCheckedFilledCC, RcIconUnCheckCC } from '../icons';
import TouchableView from '@/components/Touchable/TouchableView';
import ThemeIcon from '@/components/ThemeMode/ThemeIcon';
import { useTranslation } from 'react-i18next';
import { FormInput } from '@/components/Form/Input';

interface ConfirmAllowTransferModalProps {
  onFinished: (result: { confirmed: boolean }) => void;
  onCancel(): void;
}

export function ModalConfirmAllowTransfer({
  visible,
  onFinished,
  onCancel,
}: ConfirmAllowTransferModalProps & {
  visible: boolean;
}) {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = getStyles(colors);

  const { sheetModalRef, toggleShowSheetModal } = useSheetModal();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    toggleShowSheetModal(visible || 'destroy');

    setIsAllowed(false);
  }, [toggleShowSheetModal, visible]);

  return (
    <>
      <BottomSheetModalConfirmContainer
        ref={sheetModalRef}
        onConfirm={() => {
          onFinished?.({ confirmed: isAllowed });
        }}
        onCancel={onCancel}
        height={279}
        confirmButtonProps={{
          type: 'primary',
        }}
        bottomSheetModalProps={{
          keyboardBehavior: 'interactive',
          keyboardBlurBehavior: 'restore',
        }}>
        <View style={styles.mainContainer}>
          {/* <Text style={styles.title}>{t('page.sendToken.allowTransferModal.title')}</Text> */}
          <Text style={styles.title}>Confirm to Allow Sending</Text>

          <View style={styles.contentContainer}>
            {/* now we have no password, just  */}
            {/* <FormInput
              as={'BottomSheetTextInput'}
              style={styles.inputContainer}
              inputStyle={styles.input}
              inputProps={{
                value: password,
                onChangeText: setPassword,
                placeholder: t('page.sendToken.allowTransferModal.placeholder'),
                placeholderTextColor: colors['neutral-foot'],
                secureTextEntry: true,
              }}
            /> */}
            <TouchableView
              style={styles.confirmTextBtn}
              onPress={() => {
                setIsAllowed(prev => !prev);
              }}>
              <ThemeIcon
                src={isAllowed ? RcIconCheckedFilledCC : RcIconUnCheckCC}
                style={styles.checkboxIcon}
                color={
                  isAllowed ? colors['blue-default'] : colors['neutral-title1']
                }
              />
              <Text>{t('page.sendToken.allowTransferModal.addWhitelist')}</Text>
            </TouchableView>
          </View>
        </View>
      </BottomSheetModalConfirmContainer>
    </>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    mainContainer: {
      height: '100%',
      width: '100%',
      alignItems: 'center',
    },
    contentContainer: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    inputContainer: {
      borderRadius: 4,

      height: 52,
    },
    input: {
      backgroundColor: colors['neutral-card2'],
      fontSize: 14,
    },
    title: {
      color: colors['neutral-title1'],
      textAlign: 'center',
      fontSize: 24,
      fontStyle: 'normal',
      fontWeight: '500',
    },
    confirmTextBtn: {
      marginTop: 24,
      flexDirection: 'row',
      position: 'relative',
      alignItems: 'center',
      paddingLeft: 20,
      paddingVertical: 4,

      marginHorizontal: 'auto',
    },
    checkboxIcon: {
      position: 'absolute',
      top: 6,
      width: 16,
      height: 16,
    },
  };
});
