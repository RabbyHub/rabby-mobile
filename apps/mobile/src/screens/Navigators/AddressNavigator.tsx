import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { useTheme2024 } from '@/hooks/theme';
import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import ImportNewAddressScreen from '@/screens/Address/ImportNewAddress';
import { ImportSuccessScreen } from '../Address/ImportSuccessScreen';
import { ImportWatchAddressScreen } from '../Address/ImportWatchAddressScreen';
import { ImportWatchAddressScreen2024 } from '../Address/ImportWatchAddressScreen2024';
import AddressDetailScreen from '../Address/AddressDetail';
import { ImportMoreAddressScreen } from '../Address/ImportMoreAddressScreen';
import { ImportMoreAddressScreenButton } from '../Address/ImportMoreAddressScreenButton';
import { ImportSafeAddressScreen } from '../Address/ImportSafeAddressScreen';
import { ImportSafeAddressScreen2024 } from '../Address/ImportSafeAddressScreen2024';
import { ImportPrivateKeyScreen } from '../Address/ImportPrivateKeyScreen';
import { ImportSeedPhraseScreen } from '../Address/ImportSeedPhraseScreen';
import { BackupPrivateKeyScreen } from '../Address/BackupPrivateKeyScreen';
import { CreateSeedPhraseRickCheckScreen } from '../Address/CreateSeedPhraseRiskCheckScreen';
import { CreateSeedPhraseBackupScreen } from '../Address/CreateSeedPhraseBackupScreen';
import { CreateSeedPhraseVerifyScreen } from '../Address/CreateSeedPhraseVerifyScreen';
import { AddSeedPhraseScreen } from '../Address/AddSeedPhraseScreen/AddSeedPhraseScreen';
import { PreCreateSeedPhraseScreen } from '../Address/PreCreateSeedPhraseScreen';
import { CloudBackupButton } from '../Address/CloudBackupButton';
import { RestoreFromCloud } from '../RestoreFromCloud/RestoreFromCloud';
import { IS_IOS } from '@/core/native/utils';
import ImportMethods from '../Address/ImportMethods';
import { ImportHardwareAddressScreen } from '../Address/ImportHardwareAddress';
import { ImportPrivateKeyScreen2024 } from '../Address/ImportPrivateKeyScreen2024';
import { ImportSeedPhraseScreen2024 } from '../Address/ImportSeedPhraseScreen2024';
import { ImportSuccessScreen2024 } from '../Address/ImportSuccessScreen2024';
import { createGetStyles2024 } from '@/utils/styles';
import CreateNewAddress from '../Address/CreateNewAddress';
import CreateSelectMethod from '../Address/CreateSelectMethod';
import SetPassword2024 from '../Address/SetPassword2024';
import CreateChooseBackup from '../Address/CreateChooseBackup';
import { AddressListScreenButton } from '../Address/AddressListScreenButton';
import { WatchAddressListScreen } from '../Address/WatchAddressListScreen';
import { SafeAddressListScreen } from '../Address/SafeAddressScreen';
import { AddressNavigatorParamList } from '@/navigation-type';
import { ApprovalAddressListScreen } from '@/screens/Address/ApprovalAddressListScreen';
import { useAccounts } from '@/hooks/account';
import { ReceiveAddressListScreen } from '../Address/ReceiveAddressListScreen';
import { useTranslation } from 'react-i18next';
import { filterMyAccounts } from '@/utils/account';
import { SyncExtensionPasswordScreen } from '../SyncExtension/SyncExtensionPasswordScreen';
import { SyncExtensionAccountSuccessfulScreen } from '../SyncExtension/SyncExtensionAccountSuccessScreen';
import PointsScreen from '../Points';

const AddressStack = createNativeStackNavigator<AddressNavigatorParamList>();

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
          statusBarBackgroundColor: colors2024['neutral-bg-1'],
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
          headerTitle: t('screens.addressStackTitle.CreateWallet'),
          title: t('screens.addressStackTitle.CreateWallet'),
          headerTintColor: colors2024['neutral-title-1'],
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-0'],
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
        name={RootNames.SetPassword2024}
        component={SetPassword2024}
        options={mergeScreenOptions({
          headerTitle: t('screens.addressStackTitle.SetPassword'),
          title: t('screens.addressStackTitle.SetPassword'),
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
        options={e => {
          return mergeScreenOptions({
            headerTitle: e.route.params?.isFirstCreate
              ? t('screens.addressStackTitle.CreateChooseBackup')
              : t('screens.addressStackTitle.ChooseBackup'),
            title: e.route.params?.isFirstCreate
              ? t('screens.addressStackTitle.CreateChooseBackup')
              : t('screens.addressStackTitle.ChooseBackup'),
            headerStyle: {
              backgroundColor: colors2024['neutral-bg-1'],
            },
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
          });
        }}
      />
      <AddressStack.Screen
        name={RootNames.AddressDetail}
        component={AddressDetailScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.AddressDetail'),
          title: t('screens.addressStackTitle.AddressDetail'),
          headerStyle: {
            backgroundColor: colors2024['neutral-bg-0'],
          },
          headerTintColor: colors2024['neutral-title-1'],
          headerTitleStyle: styles.headerTitleText,
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
      {/* <AddressStack.Screen
        name={RootNames.BackupMnemonic}
        component={BackSeedPhraseScreen}
        options={{
          headerTitle: t('screens.addressStackTitle.BackupSeedPhrase'),
          title: t('screens.addressStackTitle.BackupSeedPhrase'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      /> */}
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

      <AddressStack.Screen
        name={RootNames.Points}
        component={PointsScreen}
        options={mergeScreenOptions2024([
          {
            headerTitleAlign: 'center',
            headerShown: true,
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: [styles.headerTitleText, { fontWeight: '900' }],
            headerTitle: t('page.rabbyPoints.title'),
          },
        ])}
      />
    </AddressStack.Navigator>
  );
}
