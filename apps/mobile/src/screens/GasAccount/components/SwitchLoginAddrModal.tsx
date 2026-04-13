import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { TrackedModal } from '@/components/Modal/TrackedModal';
import { GasAccountCurrentAddress } from './GasAccountLogoutPopup';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { Button } from '@/components';
import { Text } from '@/components/Typography';

interface SwitchLoginAddrBeforeDepositModalProps {
  visible: boolean;
  onCancel?: () => void;
}

export const SwitchLoginAddrBeforeDepositModal: React.FC<
  SwitchLoginAddrBeforeDepositModalProps
> = ({ visible, onCancel }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <TrackedModal
      modalId={MODAL_GATE_IDS.gasAccountSwitchLoginAddress}
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {t('page.gasAccount.switchLoginAddressBeforeDeposit.title')}
          </Text>
          <Text style={styles.description}>
            {t('page.gasAccount.switchLoginAddressBeforeDeposit.desc')}
          </Text>
          <View style={styles.accountContainer}>
            <GasAccountCurrentAddress />
          </View>
          <Button
            title={t('global.ok')}
            onPress={onCancel}
            containerStyle={styles.containerStyle}
            titleStyle={styles.titleStyle}
            buttonStyle={styles.buttonStyle}
          />
        </View>
      </View>
    </TrackedModal>
  );
};

const getStyles = createGetStyles(colors => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 320,
    backgroundColor: colors['neutral-bg1'],
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: colors['neutral-title1'],
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: colors['neutral-body'],
    textAlign: 'center',
    marginBottom: 16,
  },
  accountContainer: {
    marginHorizontal: 5,
    marginBottom: 28,
    alignSelf: 'stretch',
  },

  containerStyle: {
    width: '100%',
    height: 40,
  },
  titleStyle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title-2'],
  },
  buttonStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 6,
    width: '100%',
    height: '100%',
  },
}));
