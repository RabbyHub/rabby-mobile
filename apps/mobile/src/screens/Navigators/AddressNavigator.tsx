import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { useTheme2024 } from '@/hooks/theme';
import { AddressListScreen } from '@/screens/Address/AddressListScreen';
import {
  DEFAULT_NAVBAR_FONT_SIZE,
  makeHeadersPresets,
  RootNames,
} from '@/constant/layout';
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
import { BackSeedPhraseScreen } from '../Address/BackSeedPhraseScreen';
import { AddSeedPhraseScreen } from '../Address/AddSeedPhraseScreen/AddSeedPhraseScreen';
import { strings } from '@/utils/i18n';
import { PreCreateSeedPhraseScreen } from '../Address/PreCreateSeedPhraseScreen';
import { CloudBackupButton } from '../Address/CloudBackupButton';
import { RestoreFromCloud } from '../RestoreFromCloud/RestoreFromCloud';
import { IS_IOS } from '@/core/native/utils';
import ImportMethods from '../Address/ImportMethods';
import { ImportHardwareAddressScreen } from '../Address/ImportHardwareAddress';
import { ImportPrivateKeyScreen2024 } from '../Address/ImportPrivateKeyScreen2024';
import { ImportSeedPhraseScreen2024 } from '../Address/ImportSeedPhraseScreen2024';
import { CloudBackupButton2024 } from '../Address/CloudBackupButton2024';
import { ImportSuccessScreen2024 } from '../Address/ImportSuccessScreen2024';
import { createGetStyles2024 } from '@/utils/styles';
import CreateNewAddress from '../Address/CreateNewAddress';
import CreateSelectMethod from '../Address/CreateSelectMethod';
import SetPassword2024 from '../Address/SetPassword2024';
import CreateSelectOnCurrentSeed from '../Address/CreateSelectOnCurrentSeed/index';
import CreateChooseBackup from '../Address/CreateChooseBackup';
import { AddressListScreenButton } from '../Address/AddressListScreenButton';
import { WatchAddressListScreen } from '../Address/WatchAddressListScreen';
import { SafeAddressListScreen } from '../Address/SafeAddressScreen';
import { AddressNavigatorParamList } from '@/navigation-type';
import { ApprovalAddressListScreen } from '@/screens/Address/ApprovalAddressListScreen';

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
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
  },
}));

export function AddressNavigator() {
  const { mergeScreenOptions, mergeScreenOptions2024 } = useStackScreenConfig();
  const { colors, colors2024, styles } = useTheme2024({ getStyle });

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
            headerTitle: 'Address',
            title: 'Address',
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
            // eslint-disable-next-line react/no-unstable-nested-components
            headerRight: () => <AddressListScreenButton type="address" />,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.ApprovalAddressList}
        component={ApprovalAddressListScreen}
        options={mergeScreenOptions2024([
          {
            headerTitle: strings('page.approvalsAddressList.title'),
            title: strings('page.approvalsAddressList.title'),
            headerTintColor: colors2024['neutral-title-1'],
            headerTitleStyle: styles.headerTitleText,
          },
        ])}
      />
      <AddressStack.Screen
        name={RootNames.WatchAddressList}
        component={WatchAddressListScreen}
        options={mergeScreenOptions({
          headerTitle: 'Watch-Only Address',
          title: 'Watch-Only Address',
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
          headerTitle: 'Safe Address',
          title: 'Safe Address',
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
          headerTitle: 'Add an Address',
          title: 'Add an Address',
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
          headerTitle: 'Connect Hardware Wallets',
          title: 'Connect Hardware Wallets',
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
          title: 'Added successfully',
          headerTintColor: colors['neutral-title-2'],
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportSuccess2024}
        component={ImportSuccessScreen2024}
        options={{
          title: 'Added successfully',
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
          headerTitle: 'Add Watch-only Address',
          title: 'Add Watch-only Address',
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
            headerTitle: 'Select Import Method',
            title: 'Select Import Method',
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
          headerTitle: 'Add Safe Address',
          title: 'Add Safe Address',
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
          headerTitle: '1. Select Creation Method',
          title: '1. Select Creation Method',
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
          headerTitle: '1. Name Your Address',
          title: '1. Name Your Address',
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
          headerTitle: '2. Add Address',
          title: '2. Add Address',
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
          headerTitle: '2. Set password',
          title: '2. Set password',
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
          headerTitle: '3. Choose a backup method',
          title: '3. Choose a backup method',
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
          headerTitle: 'Address detail',
          title: 'Address detail',
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportMoreAddress}
        component={ImportMoreAddressScreen}
        options={{
          headerTitle: 'Import more address',
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
          title: 'Import more address',
          headerRight: ImportMoreAddressScreenButton,
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportPrivateKey}
        component={ImportPrivateKeyScreen}
        options={{
          headerTitle: 'Import Private Key',
          title: 'Import Private Key',
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportPrivateKey2024}
        component={ImportPrivateKeyScreen2024}
        options={{
          headerTitle: 'Import Private Key',
          title: 'Import Private Key',
          headerTitleStyle: styles.headerTitleText,
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportMnemonic}
        component={ImportSeedPhraseScreen}
        options={{
          headerTitle: 'Import Seed Phrase',
          title: 'Import Seed Phrase',
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
          headerTitle: 'Import Seed Phrase',
          title: 'Import Seed Phrase',
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
          headerTitle: strings('page.newAddress.createNewSeedPhrase'),
          title: strings('page.newAddress.createNewSeedPhrase'),
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.AddMnemonic}
        component={AddSeedPhraseScreen}
        options={{
          headerTitle: 'Add from Current Seed Phrase',
          title: 'Add from Current Seed Phrase',
        }}
      />
      <AddressStack.Screen
        name={RootNames.CreateMnemonicBackup}
        component={CreateSeedPhraseBackupScreen}
        options={{
          headerTitle: 'Backup seed phrase',
          title: 'Backup seed phrase',
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.CreateMnemonicVerify}
        component={CreateSeedPhraseVerifyScreen}
        options={{
          headerTitle: 'Verify seed phrase  ',
          title: 'Verify seed phrase',
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.BackupPrivateKey}
        component={BackupPrivateKeyScreen}
        options={{
          headerTitle: 'Backup Private Key',
          title: 'Backup Private Key',
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.BackupMnemonic}
        component={BackSeedPhraseScreen}
        options={{
          headerTitle: 'Backup Seed Phrase',
          title: 'Backup Seed Phrase',
          headerTitleStyle: {
            fontSize: DEFAULT_NAVBAR_FONT_SIZE,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.RestoreFromCloud}
        component={RestoreFromCloud}
        options={mergeScreenOptions({
          headerTitle: 'Restore from ' + (IS_IOS ? 'iCloud' : 'Google Drive'),
          headerShadowVisible: false,
          headerShown: true,
        })}
      />
    </AddressStack.Navigator>
  );
}
