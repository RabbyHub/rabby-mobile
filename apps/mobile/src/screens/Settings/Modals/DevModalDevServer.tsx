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
  ScrollView,
  Switch,
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
import {
  useDevServerSettings,
  DevServerScene,
} from '@/core/utils/devServerSettings';
import { Text, TextInput } from '@/components/Typography';

const modalVisibleAtom = atom(false);

export function useDevServerModalVisible() {
  const { devServerSettings } = useDevServerSettings();
  const [devServerSettingsModalVisible, setDevServerSettingsModalVisible] =
    useAtom(modalVisibleAtom);

  return {
    haventSetDevServer:
      !devServerSettings.devServerHosts[DevServerScene.LOCAL_WEBVIEW]
        .devServerHost,
    devServerSettingsModalVisible,
    setDevServerSettingsModalVisible,
  };
}

type SceneConfig = {
  key: DevServerScene;
  label: string;
  placeholder: string;
  portSuffix: string;
};

const SCENE_CONFIGS: SceneConfig[] = [
  {
    key: DevServerScene.LOCAL_WEBVIEW,
    label: 'Local WebView',
    placeholder: 'e.g. 192.168.0.1',
    portSuffix: ':5173',
  },
  {
    key: DevServerScene.REACTOTRON,
    label: 'Reactotron',
    placeholder: 'e.g. 192.168.0.1',
    portSuffix: ':9090',
  },
  {
    key: DevServerScene.FE_PUSH_SERVICE,
    label: 'FE Push Service',
    placeholder: 'e.g. 192.168.0.1',
    portSuffix: ':3000',
  },
];

export function DevModalDevServer() {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { devServerSettings, setDevServerHost } = useDevServerSettings();
  const {
    devServerSettingsModalVisible: visible,
    setDevServerSettingsModalVisible: setVisible,
  } = useDevServerModalVisible();
  const modalRef = useRef<AppBottomSheetModal>(null);

  // State for unified edit
  const [unifiedEditEnabled, setUnifiedEditEnabled] = useState(false);
  const [unifiedHost, setUnifiedHost] = useState('');

  // State for all 3 scenes
  const [hosts, setHosts] = useState<Record<DevServerScene, string>>({
    [DevServerScene.LOCAL_WEBVIEW]:
      devServerSettings.devServerHosts[DevServerScene.LOCAL_WEBVIEW]
        .devServerHost,
    [DevServerScene.REACTOTRON]:
      devServerSettings.devServerHosts[DevServerScene.REACTOTRON].devServerHost,
    [DevServerScene.FE_PUSH_SERVICE]:
      devServerSettings.devServerHosts[DevServerScene.FE_PUSH_SERVICE]
        .devServerHost,
  });

  useEffect(() => {
    if (visible) {
      setHosts({
        [DevServerScene.LOCAL_WEBVIEW]:
          devServerSettings.devServerHosts[DevServerScene.LOCAL_WEBVIEW]
            .devServerHost,
        [DevServerScene.REACTOTRON]:
          devServerSettings.devServerHosts[DevServerScene.REACTOTRON]
            .devServerHost,
        [DevServerScene.FE_PUSH_SERVICE]:
          devServerSettings.devServerHosts[DevServerScene.FE_PUSH_SERVICE]
            .devServerHost,
      });
      // Reset unified edit when modal opens
      setUnifiedEditEnabled(false);
      setUnifiedHost('');
    }
  }, [visible, devServerSettings.devServerHosts]);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  const handleConfirm = useCallback(() => {
    // Save all 3 scenes
    SCENE_CONFIGS.forEach(({ key }) => {
      setDevServerHost(key, hosts[key]);
    });
    setVisible(false);
  }, [hosts, setVisible, setDevServerHost]);

  const updateHost = useCallback((scene: DevServerScene, value: string) => {
    setHosts(prev => ({ ...prev, [scene]: value }));
  }, []);

  const handleUnifiedHostChange = useCallback((value: string) => {
    setUnifiedHost(value);
    // Update all 3 hosts
    setHosts({
      [DevServerScene.LOCAL_WEBVIEW]: value,
      [DevServerScene.REACTOTRON]: value,
      [DevServerScene.FE_PUSH_SERVICE]: value,
    });
  }, []);

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
            <ScrollView style={styles.body}>
              {/* Unified Edit Section */}
              <View style={[styles.inputBlock, styles.unifiedBlock]}>
                <View style={styles.unifiedHeader}>
                  <Text style={styles.fieldTitle}>统一编辑</Text>
                  <Switch
                    value={unifiedEditEnabled}
                    onValueChange={setUnifiedEditEnabled}
                    trackColor={{
                      false: colors2024['neutral-line'],
                      true: colors2024['brand-default'],
                    }}
                    thumbColor={
                      IS_IOS
                        ? colors2024['neutral-bg-1']
                        : colors2024['neutral-bg-1']
                    }
                  />
                </View>
                {unifiedEditEnabled && (
                  <FormInput
                    containerStyle={styles.textInputContainer}
                    inputProps={{
                      style: styles.textInput,
                      placeholderTextColor: colors2024['neutral-foot'],
                      placeholder: 'e.g. 192.168.0.1',
                      value: unifiedHost,
                      onChangeText: handleUnifiedHostChange,
                    }}
                  />
                )}
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {SCENE_CONFIGS.map(({ key, label, placeholder, portSuffix }) => (
                <View key={key} style={styles.inputBlock}>
                  <Text style={styles.fieldTitle}>{label}</Text>
                  <View style={styles.inputRow}>
                    <FormInput
                      containerStyle={styles.textInputContainer}
                      clearable={!unifiedEditEnabled}
                      inputProps={{
                        style: styles.textInput,
                        placeholderTextColor: colors2024['neutral-foot'],
                        placeholder,
                        value: hosts[key],
                        onChangeText: (value: string) => updateHost(key, value),
                        editable: !unifiedEditEnabled,
                      }}
                    />
                    <Text style={styles.portSuffix}>{portSuffix}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
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
    maxHeight: Dimensions.get('window').height * 0.8,
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
    maxHeight: Dimensions.get('window').height * 0.5,
  },
  inputBlock: {
    marginBlock: 12,
    width: '100%',
  },
  unifiedBlock: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 12,
    borderRadius: 12,
    marginBlock: 8,
  },
  unifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: 1,
    backgroundColor: colors2024['neutral-line'],
    marginVertical: 8,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  textInputContainer: {
    flex: 1,
    height: 56,
    borderRadius: 12,
  },
  portSuffix: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    color: colors2024['neutral-foot'],
    marginLeft: 8,
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

  footer: {
    marginTop: 16,
  },
}));
