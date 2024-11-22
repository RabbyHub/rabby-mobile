import { apiKeystone } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, View } from 'react-native';
import {
  isLoadedAtom,
  MainContainer,
  settingAtom,
  Props as MainContainerProps,
  MAX_ACCOUNT_COUNT,
} from './MainContainer';
import { HardwareSVG } from '@/assets/icons/address';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { TouchableOpacity } from '@gorhom/bottom-sheet';
import { Button } from '@/components';
import { redirectToAddAddressEntry } from '@/utils/navigation';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    switchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors['neutral-card-2'],
      borderRadius: 6,
      marginBottom: 30,
      justifyContent: 'space-between',
    },
    switchButtonText: {
      fontSize: 14,
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
    switchButtonMain: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 6,
    },
    modalMask: {
      backgroundColor: 'rgba(0,0,0,0.4)',
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      marginHorizontal: 20,
      maxWidth: 353,
      width: '100%',
      backgroundColor: colors['neutral-bg-1'],
      borderRadius: 16,
      position: 'relative',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      padding: 20,
    },
    modalDescText: {
      fontSize: 14,
      color: colors['neutral-body'],
      lineHeight: 20,
    },
    modalDesc: {
      marginBottom: 40,
      marginTop: -4,
      paddingHorizontal: 20,
    },
    modalFooter: {
      borderTopColor: colors['neutral-line'],
      borderTopWidth: 0.5,
      padding: 20,
      flexDirection: 'row',
      columnGap: 13,
      justifyContent: 'space-between',
    },
    closeButton: {
      width: 150,
      backgroundColor: 'transparent',
      borderColor: colors['blue-default'],
      borderWidth: 1,
      height: 48,
      borderRadius: 8,
    },
    closeButtonText: {
      color: colors['blue-default'],
    },
    confirmButton: {
      width: 150,
      height: 48,
      borderRadius: 8,
    },
  });

export const SettingKeystone: React.FC<{
  onDone: () => void;
  brand: string;
}> = ({ onDone, brand }) => {
  const { t } = useTranslation();
  const [, setLoading] = React.useState(false);
  const [hdPathOptions, setHdPathOptions] = React.useState<
    MainContainerProps['hdPathOptions']
  >([]);
  const [disableStartFrom, setDisableStartFrom] = React.useState(false);

  React.useEffect(() => {
    const getHdPathOptions = async () => {
      const hdPathType = await apiKeystone.getCurrentUsedHDPathType();

      if (hdPathType === LedgerHDPathType.BIP44) {
        return [
          {
            title: 'BIP44',
            description: t('page.newAddress.hd.keystone.hdPathType.bip44'),
            noChainDescription: t(
              'page.newAddress.hd.keystone.hdPathTypeNoChain.bip44',
            ),
            value: LedgerHDPathType.BIP44,
          },
        ];
      } else if (hdPathType === LedgerHDPathType.LedgerLive) {
        return [
          {
            title: 'Ledger Live',
            description: t('page.newAddress.hd.keystone.hdPathType.ledgerLive'),
            noChainDescription: t(
              'page.newAddress.hd.keystone.hdPathTypeNoChain.ledgerLive',
            ),
            value: LedgerHDPathType.LedgerLive,
          },
        ];
      } else {
        return [
          {
            title: 'Legacy',
            description: t('page.newAddress.hd.keystone.hdPathType.legacy'),
            noChainDescription: t(
              'page.newAddress.hd.keystone.hdPathTypeNoChain.legacy',
            ),
            value: LedgerHDPathType.Legacy,
          },
        ];
      }
    };

    getHdPathOptions().then(setHdPathOptions);

    apiKeystone.getMaxAccountLimit().then(limit => {
      setDisableStartFrom((limit ?? MAX_ACCOUNT_COUNT) < MAX_ACCOUNT_COUNT);
    });
  }, [t]);

  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [setting, setSetting] = useAtom(settingAtom);
  const [isLoaded, setIsLoaded] = useAtom(isLoadedAtom);

  const handleConfirm = React.useCallback(
    value => {
      setSetting(value);
      onDone?.();
    },
    [onDone, setSetting],
  );

  React.useEffect(() => {
    setLoading(false);

    if (isLoaded) {
      return;
    }

    setIsLoaded(true);
  }, [isLoaded, setIsLoaded, setSetting]);
  const [visible, setVisible] = React.useState(false);
  const handleOpenSwitch = React.useCallback(() => {
    setVisible(true);
  }, []);
  const handleModalClose = React.useCallback(() => {
    setVisible(false);
  }, []);
  const handleModalConfirm = React.useCallback(async () => {
    await apiKeystone.removeAddressAndForgetDevice();
    setVisible(false);
    onDone();
    redirectToAddAddressEntry();
  }, [onDone]);

  return (
    <MainContainer
      hdPathOptions={hdPathOptions}
      disableHdPathOptions
      disableStartFrom={disableStartFrom}
      onConfirm={handleConfirm}
      setting={setting}>
      <TouchableOpacity onPress={handleOpenSwitch} style={styles.switchButton}>
        <View style={styles.switchButtonMain}>
          <HardwareSVG width={20} height={20} />
          <Text style={styles.switchButtonText}>
            {
              t('page.newAddress.hd.qrCode.switch.title', [
                brand,
              ] as any) as string
            }
          </Text>
        </View>
        <RcIconArrowRight />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalMask}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {
                t('page.newAddress.hd.qrCode.switch.title', [
                  brand,
                ] as any) as string
              }
            </Text>
            <View style={styles.modalDesc}>
              <Text style={styles.modalDescText}>
                {
                  t('page.newAddress.hd.qrCode.switch.content', [
                    brand,
                  ] as any) as string
                }
              </Text>
            </View>
            <View style={styles.modalFooter}>
              <Button
                type="clear"
                buttonStyle={styles.closeButton}
                titleStyle={styles.closeButtonText}
                onPress={handleModalClose}
                title={t('global.Cancel')}
              />
              <Button
                buttonStyle={styles.confirmButton}
                onPress={handleModalConfirm}
                title={t('global.Confirm')}
              />
            </View>
          </View>
        </View>
      </Modal>
    </MainContainer>
  );
};
