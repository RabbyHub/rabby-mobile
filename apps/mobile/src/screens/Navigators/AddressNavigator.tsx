import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { useTheme2024 } from '@/hooks/theme';
import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import { IS_IOS } from '@/core/native/utils';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressNavigatorParamList } from '@/navigation-type';
import { useAccounts } from '@/hooks/account';
import { useTranslation } from 'react-i18next';
import { filterMyAccounts } from '@/utils/account';
import { registerAppScreen } from '@/perfs/apis';

const AddressListScreen = registerAppScreen<
  typeof import('@/screens/Address/AddressListScreen').AddressListScreen
>({
  loader: () =>
    import('@/screens/Address/AddressListScreen').then(
      m => m.AddressListScreen,
    ),
  name: RootNames.AddressList,
});
const AddressAssetsOverview = registerAppScreen<
  typeof import('@/screens/Address/AddressAssetsOverviewScreen').AddressAssetsOverview
>({
  loader: () =>
    import('@/screens/Address/AddressAssetsOverviewScreen').then(
      m => m.AddressAssetsOverview,
    ),
  name: RootNames.AddressAssetsOverview,
});
const ReceiveAddressListScreen = registerAppScreen<
  typeof import('@/screens/Address/ReceiveAddressListScreen').ReceiveAddressListScreen
>({
  loader: () =>
    import('@/screens/Address/ReceiveAddressListScreen').then(
      m => m.ReceiveAddressListScreen,
    ),
  name: RootNames.ReceiveAddressList,
});
const ApprovalAddressListScreen = registerAppScreen<
  typeof import('@/screens/Address/ApprovalAddressListScreen').ApprovalAddressListScreen
>({
  loader: () =>
    import('@/screens/Address/ApprovalAddressListScreen').then(
      m => m.ApprovalAddressListScreen,
    ),
  name: RootNames.ApprovalAddressList,
});
const WatchAddressListScreen = registerAppScreen<
  typeof import('@/screens/Address/WatchAddressListScreen').WatchAddressListScreen
>({
  loader: () =>
    import('@/screens/Address/WatchAddressListScreen').then(
      m => m.WatchAddressListScreen,
    ),
  name: RootNames.WatchAddressList,
});
const SafeAddressListScreen = registerAppScreen<
  typeof import('@/screens/Address/SafeAddressScreen').SafeAddressListScreen
>({
  loader: () =>
    import('@/screens/Address/SafeAddressScreen').then(
      m => m.SafeAddressListScreen,
    ),
  name: RootNames.SafeAddressList,
});
const ImportNewAddressScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportNewAddress').default
>({
  loader: () => import('@/screens/Address/ImportNewAddress'),
  name: RootNames.ImportNewAddress,
});
const ImportHardwareAddressScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportHardwareAddress').ImportHardwareAddressScreen
>({
  loader: () =>
    import('@/screens/Address/ImportHardwareAddress').then(
      m => m.ImportHardwareAddressScreen,
    ),
  name: RootNames.ImportHardwareAddress,
});
const ImportSuccessScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportSuccessScreen').ImportSuccessScreen
>({
  loader: () =>
    import('@/screens/Address/ImportSuccessScreen').then(
      m => m.ImportSuccessScreen,
    ),
  name: RootNames.ImportSuccess,
});
const ImportSuccessScreen2024 = registerAppScreen<
  typeof import('@/screens/Address/ImportSuccessScreen2024').ImportSuccessScreen2024
>({
  loader: () =>
    import('@/screens/Address/ImportSuccessScreen2024').then(
      m => m.ImportSuccessScreen2024,
    ),
  name: RootNames.ImportSuccess2024,
});
const ImportWatchAddressScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportWatchAddressScreen').ImportWatchAddressScreen
>({
  loader: () =>
    import('@/screens/Address/ImportWatchAddressScreen').then(
      m => m.ImportWatchAddressScreen,
    ),
  name: RootNames.ImportWatchAddress,
});
const ImportWatchAddressScreen2024 = registerAppScreen<
  typeof import('@/screens/Address/ImportWatchAddressScreen2024').ImportWatchAddressScreen2024
>({
  loader: () =>
    import('@/screens/Address/ImportWatchAddressScreen2024').then(
      m => m.ImportWatchAddressScreen2024,
    ),
  name: RootNames.ImportWatchAddress2024,
});
const ImportMethods = registerAppScreen<
  typeof import('@/screens/Address/ImportMethods').default
>({
  loader: () => import('@/screens/Address/ImportMethods'),
  name: RootNames.ImportMethods,
});
const ImportSafeAddressScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportSafeAddressScreen').ImportSafeAddressScreen
>({
  loader: () =>
    import('@/screens/Address/ImportSafeAddressScreen').then(
      m => m.ImportSafeAddressScreen,
    ),
  name: RootNames.ImportSafeAddress,
});
const ImportSafeAddressScreen2024 = registerAppScreen<
  typeof import('@/screens/Address/ImportSafeAddressScreen2024').ImportSafeAddressScreen2024
>({
  loader: () =>
    import('@/screens/Address/ImportSafeAddressScreen2024').then(
      m => m.ImportSafeAddressScreen2024,
    ),
  name: RootNames.ImportSafeAddress2024,
});
const CreateSelectMethod = registerAppScreen<
  typeof import('@/screens/Address/CreateSelectMethod').default
>({
  loader: () => import('@/screens/Address/CreateSelectMethod'),
  name: RootNames.CreateSelectMethod,
});
const CreateNewAddress = registerAppScreen<
  typeof import('@/screens/Address/CreateNewAddress').default
>({
  loader: () => import('@/screens/Address/CreateNewAddress'),
  name: RootNames.CreateNewAddress,
});
const CreateSelectOnCurrentSeed = registerAppScreen<
  typeof import('@/screens/Address/CreateSelectOnCurrentSeed').default
>({
  loader: () => import('@/screens/Address/CreateSelectOnCurrentSeed'),
  name: RootNames.CreateSelectOnCurrentSeed,
});
const SetPassword2024 = registerAppScreen<
  typeof import('@/screens/Address/SetPassword2024').default
>({
  loader: () => import('@/screens/Address/SetPassword2024'),
  name: RootNames.SetPassword2024,
});
const CreateChooseBackup = registerAppScreen<
  typeof import('@/screens/Address/CreateChooseBackup').default
>({
  loader: () => import('@/screens/Address/CreateChooseBackup'),
  name: RootNames.CreateChooseBackup,
});
const AddressDetailScreen = registerAppScreen<
  typeof import('@/screens/Address/AddressDetail').default
>({
  loader: () => import('@/screens/Address/AddressDetail'),
  name: RootNames.AddressDetail,
});
const ImportMoreAddressScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportMoreAddressScreen').ImportMoreAddressScreen
>({
  loader: () =>
    import('@/screens/Address/ImportMoreAddressScreen').then(
      m => m.ImportMoreAddressScreen,
    ),
  name: RootNames.ImportMoreAddress,
});
const ImportMoreAddressScreenButton = registerAppScreen<
  typeof import('@/screens/Address/ImportMoreAddressScreenButton').ImportMoreAddressScreenButton
>({
  loader: () =>
    import('@/screens/Address/ImportMoreAddressScreenButton').then(
      m => m.ImportMoreAddressScreenButton,
    ),
  name: 'ImportMoreAddressScreenButton',
});
const ImportPrivateKeyScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportPrivateKeyScreen').ImportPrivateKeyScreen
>({
  loader: () =>
    import('@/screens/Address/ImportPrivateKeyScreen').then(
      m => m.ImportPrivateKeyScreen,
    ),
  name: RootNames.ImportPrivateKey,
});
const ImportPrivateKeyScreen2024 = registerAppScreen<
  typeof import('@/screens/Address/ImportPrivateKeyScreen2024').ImportPrivateKeyScreen2024
>({
  loader: () =>
    import('@/screens/Address/ImportPrivateKeyScreen2024').then(
      m => m.ImportPrivateKeyScreen2024,
    ),
  name: RootNames.ImportPrivateKey2024,
});
const ImportSeedPhraseScreen = registerAppScreen<
  typeof import('@/screens/Address/ImportSeedPhraseScreen').ImportSeedPhraseScreen
>({
  loader: () =>
    import('@/screens/Address/ImportSeedPhraseScreen').then(
      m => m.ImportSeedPhraseScreen,
    ),
  name: RootNames.ImportMnemonic,
});
const ImportSeedPhraseScreen2024 = registerAppScreen<
  typeof import('@/screens/Address/ImportSeedPhraseScreen2024').ImportSeedPhraseScreen2024
>({
  loader: () =>
    import('@/screens/Address/ImportSeedPhraseScreen2024').then(
      m => m.ImportSeedPhraseScreen2024,
    ),
  name: RootNames.ImportMnemonic2024,
});
const CloudBackupButton = registerAppScreen<
  typeof import('@/screens/Address/CloudBackupButton').CloudBackupButton
>({
  loader: () =>
    import('@/screens/Address/CloudBackupButton').then(
      m => m.CloudBackupButton,
    ),
  name: 'CloudBackupButton',
});
const CloudBackupButton2024 = registerAppScreen<
  typeof import('@/screens/Address/CloudBackupButton2024').CloudBackupButton2024
>({
  loader: () =>
    import('@/screens/Address/CloudBackupButton2024').then(
      m => m.CloudBackupButton2024,
    ),
  name: 'CloudBackupButton2024',
});
const PreCreateSeedPhraseScreen = registerAppScreen<
  typeof import('@/screens/Address/PreCreateSeedPhraseScreen').PreCreateSeedPhraseScreen
>({
  loader: () =>
    import('@/screens/Address/PreCreateSeedPhraseScreen').then(
      m => m.PreCreateSeedPhraseScreen,
    ),
  name: RootNames.PreCreateMnemonic,
});
const CreateSeedPhraseRickCheckScreen = registerAppScreen<
  typeof import('@/screens/Address/CreateSeedPhraseRiskCheckScreen').CreateSeedPhraseRickCheckScreen
>({
  loader: () =>
    import('@/screens/Address/CreateSeedPhraseRiskCheckScreen').then(
      m => m.CreateSeedPhraseRickCheckScreen,
    ),
  name: RootNames.CreateMnemonic,
});
const AddSeedPhraseScreen = registerAppScreen<
  typeof import('@/screens/Address/AddSeedPhraseScreen/AddSeedPhraseScreen').AddSeedPhraseScreen
>({
  loader: () =>
    import('@/screens/Address/AddSeedPhraseScreen/AddSeedPhraseScreen').then(
      m => m.AddSeedPhraseScreen,
    ),
  name: RootNames.AddMnemonic,
});
const CreateSeedPhraseBackupScreen = registerAppScreen<
  typeof import('@/screens/Address/CreateSeedPhraseBackupScreen').CreateSeedPhraseBackupScreen
>({
  loader: () =>
    import('@/screens/Address/CreateSeedPhraseBackupScreen').then(
      m => m.CreateSeedPhraseBackupScreen,
    ),
  name: RootNames.CreateMnemonicBackup,
});
const CreateSeedPhraseVerifyScreen = registerAppScreen<
  typeof import('@/screens/Address/CreateSeedPhraseVerifyScreen').CreateSeedPhraseVerifyScreen
>({
  loader: () =>
    import('@/screens/Address/CreateSeedPhraseVerifyScreen').then(
      m => m.CreateSeedPhraseVerifyScreen,
    ),
  name: RootNames.CreateMnemonicVerify,
});
const BackupPrivateKeyScreen = registerAppScreen<
  typeof import('@/screens/Address/BackupPrivateKeyScreen').BackupPrivateKeyScreen
>({
  loader: () =>
    import('@/screens/Address/BackupPrivateKeyScreen').then(
      m => m.BackupPrivateKeyScreen,
    ),
  name: RootNames.BackupPrivateKey,
});
const BackSeedPhraseScreen = registerAppScreen<
  typeof import('@/screens/Address/BackSeedPhraseScreen').BackSeedPhraseScreen
>({
  loader: () =>
    import('@/screens/Address/BackSeedPhraseScreen').then(
      m => m.BackSeedPhraseScreen,
    ),
  name: RootNames.BackupMnemonic,
});
const RestoreFromCloud = registerAppScreen<
  typeof import('@/screens/RestoreFromCloud/RestoreFromCloud').RestoreFromCloud
>({
  loader: () =>
    import('@/screens/RestoreFromCloud/RestoreFromCloud').then(
      m => m.RestoreFromCloud,
    ),
  name: RootNames.RestoreFromCloud,
});
const SyncExtensionPasswordScreen = registerAppScreen<
  typeof import('@/screens/SyncExtension/SyncExtensionPasswordScreen').SyncExtensionPasswordScreen
>({
  loader: () =>
    import('@/screens/SyncExtension/SyncExtensionPasswordScreen').then(
      m => m.SyncExtensionPasswordScreen,
    ),
  name: RootNames.SyncExtensionPassword,
});
const SyncExtensionAccountSuccessfulScreen = registerAppScreen<
  typeof import('@/screens/SyncExtension/SyncExtensionAccountSuccessScreen').SyncExtensionAccountSuccessfulScreen
>({
  loader: () =>
    import('@/screens/SyncExtension/SyncExtensionAccountSuccessScreen').then(
      m => m.SyncExtensionAccountSuccessfulScreen,
    ),
  name: RootNames.SyncExtensionAccountSuccess,
});
const AddressListScreenButton = registerAppScreen<
  typeof import('@/screens/Address/AddressListScreenButton').AddressListScreenButton
>({
  loader: () =>
    import('@/screens/Address/AddressListScreenButton').then(
      m => m.AddressListScreenButton,
    ),
  name: 'AddressListScreenButton',
});

const AddressStack =
  createCustomNativeStackNavigator<AddressNavigatorParamList>();

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  headerRight: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerRightText: {
    color: colors2024['brand-default'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  headerTitleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
  },
}));

export function AddressNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  const { colors, colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const mainAddressCount = React.useMemo(
    () => filterMyAccounts(accounts).length,
    [accounts],
  );

  return (
    <AddressStack.Navigator
      screenOptions={mergeScreenOptions({
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: colors['neutral-title-1'],
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: '500',
          fontSize: DEFAULT_NAVBAR_FONT_SIZE,
        },
        headerTitle: '',
      })}>
      <AddressStack.Screen
        name={RootNames.AddressList}
        component={AddressListScreen}
        options={mergeScreenOptions2024([
          {
            headerTitle: t('page.addressDetail.addressListScreen.title', {
              count: mainAddressCount,
            }),
            title: 'Address',
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
            // eslint-disable-next-line react/no-unstable-nested-components
            headerRight: () => <AddressListScreenButton type="address" />,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.AddressAssetsOverview}
        component={AddressAssetsOverview}
        options={mergeScreenOptions2024([
          {
            // title: 'Address',
            headerRight: () => <AddressListScreenButton type="address" />,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.ReceiveAddressList}
        component={ReceiveAddressListScreen}
        options={mergeScreenOptions2024([
          {
            headerTitle: t('page.receiveAddressList.title'),
            title: t('page.receiveAddressList.title'),
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.ApprovalAddressList}
        component={ApprovalAddressListScreen}
        options={mergeScreenOptions2024([
          {
            headerTitle: t('page.approvalsAddressList.title'),
            title: t('page.approvalsAddressList.title'),
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.WatchAddressList}
        component={WatchAddressListScreen}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.WatchAddressList'),
          title: t('screens.addressStackTitle.WatchAddressList'),
          headerTintColor: colors2024['neutral-title-1'],
          headerTitleStyle: styles.headerTitleText,
          // eslint-disable-next-line react/no-unstable-nested-components
          headerRight: () => <AddressListScreenButton type="watch-address" />,
        })}
      />
      <AddressStack.Screen
        name={RootNames.SafeAddressList}
        component={SafeAddressListScreen}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.SafeAddressList'),
          title: t('screens.addressStackTitle.SafeAddressList'),
          headerTintColor: colors2024['neutral-title-1'],
          headerTitleStyle: styles.headerTitleText,
          // eslint-disable-next-line react/no-unstable-nested-components
          headerRight: () => <AddressListScreenButton type="safe-address" />,
        })}
      />

      <AddressStack.Screen
        name={RootNames.ImportNewAddress}
        component={ImportNewAddressScreen}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.ImportNewAddress'),
          title: t('screens.addressStackTitle.ImportNewAddress'),
          headerTintColor: colors['neutral-title-1'],
          headerTitleStyle: {
            // fontWeight: '500',
            color: colors['neutral-title-1'],
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.ImportHardwareAddress}
        component={ImportHardwareAddressScreen}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.ImportHardwareAddress'),
          title: t('screens.addressStackTitle.ImportHardwareAddress'),
          headerTintColor: colors2024['neutral-title-1'],
          headerTitleStyle: styles.headerTitleText,
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
        })}
      />
      <AddressStack.Screen
        name={RootNames.ImportSuccess}
        component={ImportSuccessScreen}
        options={{
          title: t('screens.addressStackTitle.ImportSuccess'),
          headerTintColor: colors['neutral-title-2'],
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportSuccess2024}
        component={ImportSuccessScreen2024}
        options={{
          title: t('screens.addressStackTitle.ImportSuccess'),
          headerTintColor: colors2024['neutral-bg-1'],
          statusBarColor: colors2024['neutral-bg-1'],
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportWatchAddress}
        component={ImportWatchAddressScreen}
        options={{
          headerTintColor: colors['neutral-title-2'],
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportWatchAddress2024}
        component={ImportWatchAddressScreen2024}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.ImportWatchAddress2024'),
          title: t('screens.addressStackTitle.ImportWatchAddress2024'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.ImportMethods}
        component={ImportMethods}
        options={mergeScreenOptions2024([
          {
            headerTitle: t('screens.addressStackTitle.ImportMethods'),
            title: t('screens.addressStackTitle.ImportMethods'),
            headerTintColor: colors['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.ImportSafeAddress}
        component={ImportSafeAddressScreen}
        options={{
          headerTintColor: colors['neutral-title-2'],
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportSafeAddress2024}
        component={ImportSafeAddressScreen2024}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.ImportSafeAddress2024'),
          title: t('screens.addressStackTitle.ImportSafeAddress2024'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateSelectMethod}
        component={CreateSelectMethod}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.CreateSelectMethod'),
          title: t('screens.addressStackTitle.CreateSelectMethod'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateNewAddress}
        component={CreateNewAddress}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.CreateNewAddress'),
          title: t('screens.addressStackTitle.CreateNewAddress'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateSelectOnCurrentSeed}
        component={CreateSelectOnCurrentSeed}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.CreateSelectOnCurrentSeed'),
          title: t('screens.addressStackTitle.CreateSelectOnCurrentSeed'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.SetPassword2024}
        component={SetPassword2024}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.SetPassword2024'),
          title: t('screens.addressStackTitle.SetPassword2024'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.CreateChooseBackup}
        component={CreateChooseBackup}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.CreateChooseBackup'),
          title: t('screens.addressStackTitle.CreateChooseBackup'),
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-1'],
          },
          headerTintColor: colors2024['neutral-title-1'],
          headerTitleStyle: styles.headerTitleText,
        })}
      />
      <AddressStack.Screen
        name={RootNames.AddressDetail}
        component={AddressDetailScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.AddressDetail'),
          title: t('screens.addressStackTitle.AddressDetail'),
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportMoreAddress}
        component={ImportMoreAddressScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.ImportMoreAddress'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
          title: t('screens.addressStackTitle.ImportMoreAddress'),
          headerRight: ImportMoreAddressScreenButton,
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportPrivateKey}
        component={ImportPrivateKeyScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.ImportPrivateKey'),
          title: t('screens.addressStackTitle.ImportPrivateKey'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportPrivateKey2024}
        component={ImportPrivateKeyScreen2024}
        options={{
          headerTitle: t('screens.addressStackTitle.ImportPrivateKey'),
          title: t('screens.addressStackTitle.ImportPrivateKey'),
          headerTitleStyle: styles.headerTitleText,
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportMnemonic}
        component={ImportSeedPhraseScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.ImportMnemonic'),
          title: t('screens.addressStackTitle.ImportMnemonic'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
          headerRight: CloudBackupButton,
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportMnemonic2024}
        component={ImportSeedPhraseScreen2024}
        options={{
          headerTitle: t('screens.addressStackTitle.ImportMnemonic'),
          title: t('screens.addressStackTitle.ImportMnemonic'),
          headerTitleStyle: styles.headerTitleText,
          headerRight: CloudBackupButton2024,
        }}
      />
      <AddressStack.Screen
        name={RootNames.PreCreateMnemonic}
        component={PreCreateSeedPhraseScreen}
      />
      <AddressStack.Screen
        name={RootNames.CreateMnemonic}
        component={CreateSeedPhraseRickCheckScreen}
        options={{
          headerTitle: t('page.newAddress.createNewSeedPhrase'),
          title: t('page.newAddress.createNewSeedPhrase'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.AddMnemonic}
        component={AddSeedPhraseScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.AddMnemonic'),
          title: t('screens.addressStackTitle.AddMnemonic'),
        }}
      />
      <AddressStack.Screen
        name={RootNames.CreateMnemonicBackup}
        component={CreateSeedPhraseBackupScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.CreateMnemonicBackup'),
          title: t('screens.addressStackTitle.CreateMnemonicBackup'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      {/* no use RootNames page */}
      <AddressStack.Screen
        name={RootNames.CreateMnemonicVerify}
        component={CreateSeedPhraseVerifyScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.VerifySeedPhrase'),
          title: t('screens.addressStackTitle.VerifySeedPhrase'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.BackupPrivateKey}
        component={BackupPrivateKeyScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.BackupPrivateKey'),
          title: t('screens.addressStackTitle.BackupPrivateKey'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.BackupMnemonic}
        component={BackSeedPhraseScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.BackupSeedPhrase'),
          title: t('screens.addressStackTitle.BackupSeedPhrase'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.RestoreFromCloud}
        component={RestoreFromCloud}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.RestoreFromCloud', {
            type: IS_IOS ? 'iCloud' : 'Google Drive',
          }),
          headerShadowVisible: false,
          headerShown: true,
        })}
      />
      <AddressStack.Screen
        name={RootNames.SyncExtensionPassword}
        component={SyncExtensionPasswordScreen}
        options={mergeScreenOptions({
          headerShadowVisible: false,
          headerShown: true,
        })}
      />

      <AddressStack.Screen
        name={RootNames.SyncExtensionAccountSuccess}
        component={SyncExtensionAccountSuccessfulScreen}
        options={mergeScreenOptions({
          headerShadowVisible: false,
          headerShown: false,
        })}
      />
    </AddressStack.Navigator>
  );
}
