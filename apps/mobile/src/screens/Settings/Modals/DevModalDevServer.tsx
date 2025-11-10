import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { atom, useAtom } from 'jotai';

import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { FooterButtonGroup } from '@/components2024/FooterButtonGroup';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { Modal } from 'react-native';
import { IS_IOS } from '@/core/native/utils';
import { FormInput } from '@/components/Form/Input';
import { useDevServerSettings } from '@/core/utils/devServerSettings';

const modalVisibleAtom = atom(false);
export function useDevServerModalVisible() {
  const { devServerSettings } = useDevServerSettings();
  const [devServerSettingsModalVisible, setDevServerSettingsModalVisible] =
    useAtom(modalVisibleAtom);

  return {
    haventSetDevServer: !devServerSettings.devServerHost,
    devServerSettingsModalVisible,
    setDevServerSettingsModalVisible,
  };
}

export function DevModalDevServer() {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { devServerSettings, setDevServerHost } = useDevServerSettings();
  const {
    devServerSettingsModalVisible: visible,
    setDevServerSettingsModalVisible: setVisible,
  } = useDevServerModalVisible();
  const modalRef = useRef<AppBottomSheetModal>(null);

  const [hostname, setHostname] = useState(devServerSettings.devServerHost);

  useEffect(() => {
    if (visible) {
      setHostname(devServerSettings.devServerHost);
    }
  }, [visible, devServerSettings.devServerHost]);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const handleConfirm = useCallback(() => {
    setDevServerHost(hostname);
    setVisible(false);
  }, [hostname, setVisible, setDevServerHost]);

  useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      style={styles.modalComp}>
      <AutoLockView style={styles.modalMask}>
        <KeyboardAvoidingView behavior={IS_IOS ? 'padding' : 'height'}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Dev Server Settings</Text>
            </View>
            <View style={styles.body}>
              <View style={styles.inputBlock}>
                <Text style={styles.fieldTitle}>Server</Text>
                <FormInput
                  containerStyle={styles.textInputContainer}
                  inputProps={{
                    style: styles.textInput,
                    placeholderTextColor: colors2024['neutral-foot'],
                    placeholder: 'Input Metro Server on your LAN',
                    value: hostname,
                    onChangeText: setHostname,
                  }}
                />
                {/* {host !== INITIAL_OPENAPI_URL ? (
                  <View style={styles.extra}>
                    <TouchableOpacity
                      onPress={() => {
                        setHost(INITIAL_OPENAPI_URL);
                      }}>
                      <Text style={styles.extraText}>
                        Restore initial setting
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null} */}
              </View>
            </View>
            <FooterButtonGroup
              style={styles.footer}
              onCancel={handleClose}
              onConfirm={handleConfirm}
            />
          </View>
        </KeyboardAvoidingView>
      </AutoLockView>
    </Modal>
  );
}

const MODAL_H_PADDING = 20;
const MODAL_INNER_H_PADDING = 20;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
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
    paddingTop: 21,
    paddingBottom: 13,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    paddingBottom: 0,
  },
  body: {
    width: '100%',
    paddingHorizontal: MODAL_INNER_H_PADDING,
    // ...makeDebugBorder(),
  },
  inputBlock: {
    marginBlock: 12,
    width: '100%',
  },
  fieldTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-title-1'],
    paddingBottom: 0,
    marginBottom: 4,
  },

  textInputContainer: {
    height: 56,
    borderRadius: 12,
  },
  textInput: {
    color: colors2024['neutral-title-1'],
    fontWeight: '400',
    fontSize: 16,
    textAlign: undefined,
    lineHeight: undefined,
    backgroundColor: colors2024['neutral-bg-gray'],
  },
  extra: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },

  extraText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['brand-default'],
  },

  footer: {},
}));
