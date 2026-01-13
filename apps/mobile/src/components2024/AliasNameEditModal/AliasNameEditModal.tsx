import DeviceUtils from '@/core/utils/device';
import { useAlias } from '@/hooks/alias';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import { useAtom } from 'jotai';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AliasNameEditView } from './AliasNameEditView';
import {
  useAliasNameEditModalState,
  confirmCallBack,
} from './useAliasNameEditModal';

export const AliasNameEditModal: React.FC = () => {
  const { styles } = useTheme2024({ getStyle });
  const {
    visible,
    account,
    accountIconUri: iconUri,
    setVisible,
  } = useAliasNameEditModalState();

  const [_, updateAliasName] = useAlias(account?.address || '');
  const [input, setInput] = React.useState(account?.aliasName || '');
  const [loading, setLoading] = React.useState(false);
  const onCancel = React.useCallback(() => {
    setVisible(false);
    confirmCallBack.value = undefined;
  }, [setVisible]);

  const onConfirm = React.useCallback(() => {
    if (!account) {
      return;
    }
    setLoading(true);
    if (confirmCallBack.value) {
      confirmCallBack.value(input || ellipsisAddress(account.address));
    } else {
      updateAliasName(input || ellipsisAddress(account.address));
    }
    setLoading(false);
    setVisible(false);
    confirmCallBack.value = undefined;
    setInput('');
  }, [account, input, setVisible, updateAliasName]);

  React.useEffect(() => {
    setInput(account?.aliasName || '');
  }, [account]);

  return (
    <Modal
      style={styles.root}
      visible={visible}
      transparent
      animationType="fade">
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.body}>
            {account && (
              <AliasNameEditView
                iconSize={66}
                iconBorderRadius={16}
                account={account}
                accoutnIconUri={iconUri}
                onChange={setInput}
              />
            )}
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              disabled={loading}
              style={StyleSheet.flatten([
                styles.button,
                loading && { opacity: 0.5 },
              ])}
              onPress={onConfirm}>
              <Text
                style={StyleSheet.flatten([
                  styles.buttonText,
                  styles.buttonConfirmText,
                ])}>
                Done
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={loading}
              style={styles.button}
              onPress={onCancel}>
              <Text
                style={StyleSheet.flatten([
                  styles.buttonText,
                  styles.buttonCancelText,
                ])}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: DeviceUtils.getDeviceWidth() - 40,
    backgroundColor: colors2024['neutral-bg-3'],
    borderRadius: 20,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
  },
  footer: {},
  button: {
    paddingVertical: 20,
    textAlign: 'center',
    alignItems: 'center',
    borderTopColor: colors2024['neutral-line'],
    borderTopWidth: 1,
  },
  buttonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonConfirmText: {
    color: colors2024['brand-default'],
  },
  buttonCancelText: {
    color: colors2024['neutral-info'],
  },
}));
