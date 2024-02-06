import React, { useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import IconDice from '@/assets/icons/points/dice-cc.svg';

import { useRabbyPointsInvitedCodeCheck } from '../hooks';
import { customAlphabet } from 'nanoid';
import { useTranslation } from 'react-i18next';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { AppBottomSheetModal, Button } from '@/components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { toast } from '@/components/Toast';
import { devLog } from '@/utils/logger';

export const SetReferralCode: React.FC<{
  onSetCode: (code: string) => Promise<void>;
}> = ({ onSetCode }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const changedRef = useRef(false);

  const debounceInput = useDeferredValue(input);

  const { codeStatus, codeLoading } =
    useRabbyPointsInvitedCodeCheck(debounceInput);

  const [desc, isError] = useMemo(() => {
    if (!input) {
      if (!changedRef.current) {
        return [' ', false];
      }
      return [
        t('page.rabbyPoints.referralCode.referral-code-cannot-be-empty'),
        true,
      ];
    }
    if (input.length > 15) {
      return [
        t(
          'page.rabbyPoints.referralCode.referral-code-cannot-exceed-15-characters',
        ),
        true,
      ];
    }
    if (codeStatus?.invite_code_exist) {
      return [
        t('page.rabbyPoints.referralCode.referral-code-already-exists'),
        true,
      ];
    }
    if (codeLoading) {
      return [' ', false];
    }
    return [t('page.rabbyPoints.referralCode.referral-code-available'), false];
  }, [input, codeStatus?.invite_code_exist, codeLoading, t]);

  const disabled = useMemo(() => {
    return !input || isError || codeLoading;
  }, [input, isError, codeLoading]);

  const openPopup = React.useCallback(() => {
    modalRef.current?.present();
    changedRef.current = false;
  }, []);

  const closePopup = React.useCallback(() => {
    modalRef.current?.dismiss();
  }, []);

  const inputChange = React.useCallback((text: string) => {
    if (/^[a-zA-Z0-9]+$/.test(text) || text === '') {
      setInput(text?.toUpperCase());
      changedRef.current = true;
    }
  }, []);

  const getDiceReferralCode = () => {
    const nanoId = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
    const id = nanoId();
    setInput(id);
  };

  const submitReferralCode = React.useCallback(async () => {
    console.log('disabled', disabled);
    if (disabled) {
      return;
    }
    try {
      await onSetCode(input);
      closePopup();
    } catch (error) {
      devLog('submitReferralCode error', error);
      toast.info(String((error as any)?.message || error));
    }
  }, [disabled, onSetCode, input, closePopup]);

  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => [352 + bottom], [bottom]);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.tip1}>
          {t('page.rabbyPoints.referralCode.my-referral-code')}
        </Text>
        <Text style={styles.tip2}>
          {t('page.rabbyPoints.referralCode.refer-a-new-user-to-get-50-points')}
        </Text>
      </View>
      <Button
        title={t('page.rabbyPoints.referralCode.set-my-code')}
        titleStyle={styles.buttonText}
        buttonStyle={styles.button}
        onPress={openPopup}
      />
      <AppBottomSheetModal
        ref={modalRef}
        keyboardBlurBehavior="restore"
        snapPoints={snapPoints}>
        <BottomSheetView
          style={[styles.popupContainer, { paddingBottom: insets.bottom }]}>
          <Text style={styles.modalTitle}>
            {t('page.rabbyPoints.referralCode.set-my-referral-code')}
          </Text>
          <View style={styles.relative}>
            <BottomSheetTextInput
              value={input}
              onChangeText={inputChange}
              style={StyleSheet.flatten([
                styles.input,
                isError && styles.errorInput,
              ])}
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity
              style={styles.diceButton}
              onPress={getDiceReferralCode}>
              <IconDice width={24} height={24} color={colors['neutral-foot']} />
            </TouchableOpacity>
          </View>
          {desc && (
            <Text
              style={StyleSheet.flatten([
                styles.tip2,
                isError ? styles.errorText : styles.validText,
              ])}>
              {desc}
            </Text>
          )}
          <View style={styles.list}>
            <View style={styles.relative}>
              <Text style={styles.listNum}>1.</Text>
              <Text style={styles.listItem}>
                {t(
                  'page.rabbyPoints.referralCode.once-set-this-referral-code-is-permanent-and-cannot-change',
                )}
              </Text>
            </View>
            <View style={styles.relative}>
              <Text style={styles.listNum}>2.</Text>
              <Text style={styles.listItem}>
                {t(
                  'page.rabbyPoints.referralCode.max-15-characters-use-numbers-and-letters-only',
                )}
              </Text>
            </View>
          </View>

          <Button
            ghost
            disabled={disabled}
            title={t('page.rabbyPoints.referralCode.confirm')}
            titleStyle={styles.buttonText}
            buttonStyle={[styles.confirmButton]}
            onPress={submitReferralCode}
          />
        </BottomSheetView>
      </AppBottomSheetModal>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    backgroundColor: colors['blue-light1'],
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  tip1: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['blue-default'],
  },
  tip2: {
    fontSize: 11,
    marginVertical: 4,
    color: colors['blue-default'],
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title2'],
  },
  button: {
    borderRadius: 4,
    height: 34,
    minWidth: 132,
    backgroundColor: colors['blue-default'],
  },
  popupContainer: {
    padding: 20,
    flex: 1,
    flexDirection: 'column',
  },
  input: {
    paddingLeft: 12,
    paddingRight: 30,
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'left',
    backgroundColor: colors['neutral-bg1'],
    borderColor: colors['blue-default'],
  },
  errorInput: {
    borderColor: colors['red-default'],
  },
  validInput: {
    borderColor: colors['blue-default'],
  },
  diceButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  errorText: {
    color: colors['red-default'],
  },
  validText: {
    color: colors['green-default'],
  },
  relative: {
    position: 'relative',
  },
  list: {
    width: '100%',
    backgroundColor: colors['neutral-card-3'],
    borderRadius: 8,
    paddingVertical: 12,
    paddingRight: 6,
    paddingLeft: 26,
    gap: 6,
    marginBottom: 26,
  },
  listNum: {
    position: 'absolute',
    left: -20,
    top: 0,
    paddingLeft: 6,
    fontSize: 13,
    color: colors['neutral-body'],
  },
  listItem: {
    fontSize: 13,
    color: colors['neutral-body'],
  },
  confirmButton: {
    borderRadius: 6,
    height: 52,
    width: '100%',
    backgroundColor: colors['blue-default'],
  },
}));
