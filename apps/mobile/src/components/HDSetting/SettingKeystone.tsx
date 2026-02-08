import { apiKeystone } from '@/core/apis';
import { LedgerHDPathType } from '@rabby-wallet/eth-keyring-ledger/dist/utils';
import { useAtom } from 'jotai';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
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
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

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

  const handleAddNewDevice = React.useCallback(() => {
    onDone();
    let preserveActiveForImportMore = false;
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.CONNECT_KEYSTONE,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        onDismiss: () => {
          if (!preserveActiveForImportMore) {
            apiKeystone.clearActiveKeystoneKeyring();
          }
        },
      },
      onDone: result => {
        preserveActiveForImportMore = !!result?.preserveActiveForImportMore;
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, [onDone]);

  return (
    <MainContainer
      hdPathOptions={hdPathOptions}
      disableHdPathOptions
      disableStartFrom={disableStartFrom}
      onConfirm={handleConfirm}
      setting={setting}>
      <TouchableOpacity
        onPress={handleAddNewDevice}
        style={styles.switchButton}>
        <View style={styles.switchButtonMain}>
          <HardwareSVG width={20} height={20} />
          <Text style={styles.switchButtonText}>
            {t('page.newAddress.keystone.addNewDevice', { brand })}
          </Text>
        </View>
        <RcIconArrowRight />
      </TouchableOpacity>
    </MainContainer>
  );
};
