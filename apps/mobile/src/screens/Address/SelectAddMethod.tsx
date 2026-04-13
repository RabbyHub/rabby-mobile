import React, { useRef } from 'react';
import { View, ScrollView, Pressable } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Card } from '@/components2024/Card';

import { RootNames } from '@/constant/layout';

import IconCreateWallet from '@/assets2024/icons/common/icon-create-wallet.svg';
import IconImportSeedPhrase from '@/assets2024/icons/common/icon-import-seed-phrase.svg';
import IconImportPrivateKey from '@/assets2024/icons/common/icon-import-private-key.svg';
import IconConnectHardware from '@/assets2024/icons/common/icon-connect-hardware.svg';
import IconRestoreRabby from '@/assets2024/icons/common/icon-restore-rabby.svg';
import RcArrowRight2CC from '@/assets/icons/common/right-2-cc.svg';

import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { useSeedPhrase } from '@/hooks/useSeedPhrase';
import { IS_IOS } from '@/core/native/utils';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { keyringService } from '@/core/services';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { apiMnemonic } from '@/core/apis';
import { addKeyringAndactiveAndPersistAccounts } from '@/core/apis/mnemonic';
import { ellipsisAddress } from '@/utils/address';
import { replaceToFirst } from '@/utils/navigation';
import { toast } from '@/components2024/Toast';
import { setAccountNeedsBackupReminder } from '@/hooks/account';
import { useImportAddressProc } from '@/hooks/address/useNewUser';

type SelectAddMethodProps = NativeStackScreenProps<
  RootStackParamsList,
  'SelectAddMethod'
>;

function SelectAddMethod(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const { t } = useTranslation();
  const navigation = useNavigation<SelectAddMethodProps['navigation']>();
  const { seedPhraseList } = useSeedPhrase();
  const { setConfirmCB } = useImportAddressProc();
  const creatingRef = useRef(false);

  const handleCreateNewSeed = React.useCallback(async () => {
    if (creatingRef.current) {
      return;
    }
    creatingRef.current = true;
    try {
      const seedPhrase = await apiMnemonic.generatePreMnemonic();
      const Keyring = keyringService.getKeyringClassForType(
        KEYRING_CLASS.MNEMONIC,
      ) as any;
      const keyring = new Keyring({ mnemonic: seedPhrase, passphrase: '' });
      const accountsToCreate = keyring?.getAddresses(0, 1);
      const address = accountsToCreate?.[0]?.address;

      await addKeyringAndactiveAndPersistAccounts(
        seedPhrase,
        '',
        accountsToCreate.map((acc: any) => ({
          address: acc.address,
          aliasName: '',
          index: acc.index,
        })),
        false,
      );
      keyringService.removePreMnemonics();

      await setAccountNeedsBackupReminder(
        {
          address,
          type: KEYRING_TYPE.HdKeyring,
          brandName: KEYRING_CLASS.MNEMONIC,
        },
        true,
      );

      replaceToFirst(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: KEYRING_TYPE.HdKeyring,
          brandName: KEYRING_CLASS.MNEMONIC,
          isFirstCreate: true,
          address: [address],
          mnemonics: seedPhrase,
          passphrase: '',
          isExistedKR: false,
          alias: ellipsisAddress(address),
          showBackup: true,
        },
      });
    } catch (e) {
      console.error('handleCreateNewSeed error', e);
      toast.show('Failed to create wallet');
    } finally {
      creatingRef.current = false;
    }
  }, []);

  const onPressCreateWallet = React.useCallback(async () => {
    if (seedPhraseList.length > 0) {
      if (
        await shouldRedirectToSetPasswordBefore2024({
          backScreen: RootNames.CreateSelectMethod,
        })
      ) {
        return;
      }
      navigation.navigate(RootNames.StackAddress, {
        screen: RootNames.CreateSelectMethod,
      });
    } else {
      setConfirmCB(async () => {
        await handleCreateNewSeed();
      });
      if (
        await shouldRedirectToSetPasswordBefore2024({
          backScreen: RootNames.CreateSelectMethod,
          isFirstImportPassword: true,
        })
      ) {
        return;
      }
      await handleCreateNewSeed();
    }
  }, [
    shouldRedirectToSetPasswordBefore2024,
    seedPhraseList.length,
    navigation,
    handleCreateNewSeed,
    setConfirmCB,
  ]);

  const onPressImportSeedPhrase = React.useCallback(() => {
    navigation.navigate(RootNames.ImportSecret, {
      initialTab: 'seedPhrase',
      flow: 'in_app',
    });
  }, [navigation]);

  const onPressImportPrivateKey = React.useCallback(() => {
    navigation.navigate(RootNames.ImportSecret, {
      initialTab: 'privateKey',
      flow: 'in_app',
    });
  }, [navigation]);

  const onPressHardwareWallet = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.ImportHardwareAddress,
    });
  }, [navigation]);

  const onPressRestoreRabby = React.useCallback(() => {
    navigation.navigate(RootNames.ImportRabbyWallet, {
      flow: 'in_app',
    });
  }, [navigation]);

  const onPressMoreOptions = React.useCallback(() => {
    navigation.navigate(RootNames.MoreImportMethods);
  }, [navigation]);

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Main cards */}
        <View style={styles.cardGroup}>
          {/* Create Wallet */}
          <Card style={styles.cardItem} onPress={onPressCreateWallet}>
            <IconCreateWallet style={styles.icon} />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.addAddress.createAddress')}
            </Text>
          </Card>

          {/* Import Seed Phrase */}
          <Card style={styles.cardItem} onPress={onPressImportSeedPhrase}>
            <IconImportSeedPhrase style={styles.icon} />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.importAddress.seedPhrase')}
            </Text>
          </Card>

          {/* Import Private Key */}
          <Card style={styles.cardItem} onPress={onPressImportPrivateKey}>
            <IconImportPrivateKey style={styles.icon} />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.importAddress.privateKey')}
            </Text>
          </Card>

          {/* Connect Hardware Wallet */}
          <Card style={styles.cardItem} onPress={onPressHardwareWallet}>
            <IconConnectHardware style={styles.icon} />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.importAddress.hardWare')}
            </Text>
          </Card>
        </View>

        {/* Restore Rabby Wallet section */}
        <View style={styles.restoreSection}>
          <Text style={styles.restoreSubtitle}>
            {t('page.nextComponent.importAddress.ImportFromExtensionOrCloud', {
              cloud: IS_IOS ? 'iCloud' : 'Google Drive',
            })}
          </Text>
          <Card style={styles.cardItem} onPress={onPressRestoreRabby}>
            <IconRestoreRabby style={styles.icon} />
            <Text style={styles.cardTitle}>
              {t('page.nextComponent.addAddress.restoreRabbyWallet')}
            </Text>
          </Card>
        </View>
      </ScrollView>

      {/* More options */}
      <Pressable style={styles.moreOptionsWrapper} onPress={onPressMoreOptions}>
        <Text style={styles.moreOptionsText}>More options</Text>
        <RcArrowRight2CC
          width={10}
          height={10}
          color={colors2024['neutral-secondary']}
        />
      </Pressable>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  cardGroup: {
    gap: 12,
  },
  cardItem: {
    display: 'flex',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ctx.colors2024['neutral-card-1'],
    borderWidth: 0,
    shadowColor: 'rgba(55, 56, 63, 0.02)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 40,
  },
  icon: {
    width: 40,
    height: 40,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  restoreSection: {
    marginTop: 24,
    gap: 8,
  },
  restoreSubtitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'left',
    color: ctx.colors2024['neutral-secondary'],
    paddingHorizontal: 8,
  },
  moreOptionsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    position: 'absolute',
    bottom: 67,
  },
  moreOptionsText: {
    color: ctx.colors2024['neutral-secondary'],
    fontWeight: '500',
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
  },
}));

export default SelectAddMethod;
