import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, TextInput, View } from 'react-native';

import { RcWarningFull } from '@/assets2024/icons/perps';
import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

interface Props {
  visible: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

export const PerpsAutoCloseModal: React.FC<Props> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <KeyboardAwareScrollView
            enableOnAndroid
            scrollEnabled
            keyboardOpeningTime={0}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.inner}
            keyboardDismissMode="interactive">
            <View style={styles.header}>
              <Text style={styles.title}>Long ETH-USD</Text>
              <Text style={styles.subTitle}>ETH-USD Price : $4,123.12</Text>
            </View>
            <View style={styles.body}>
              <View style={styles.formItem}>
                <Text style={styles.formItemLabel}>Margin</Text>

                <TextInput
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="$0"
                />
                <Text style={styles.errorMsg}>Insufficient balance</Text>
              </View>
              <View style={styles.formItem}>
                <Text style={styles.formItemLabel}>Margin</Text>

                <TextInput
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="$0"
                />

                <Text style={styles.errorMsg}>Insufficient balance</Text>
              </View>
            </View>
            <View style={styles.footer}>
              <Button
                type="primary"
                title={t('global.confirm')}
                onPress={onConfirm}
                containerStyle={styles.containerStyle}
              />
            </View>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 20,
  },

  inner: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    marginBottom: 8,
  },

  subTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-body'],
  },

  body: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    // alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },

  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-body'],
    marginBottom: 32,
    marginTop: 12,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  accountContainer: {
    marginHorizontal: 5,
    marginBottom: 28,
    alignSelf: 'stretch',
  },

  containerStyle: {
    // width: '100%',
    // height: 40,
    height: 48,
    flex: 1,
  },
  buttonStyle: {},

  formItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    minHeight: 115,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
  },
  formItemLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  formItemDesc: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  errorMsg: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['red-default'],
  },
  input: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    // color: ctx.colors2024['neutral-body'],
    flex: 1,
  },
}));
