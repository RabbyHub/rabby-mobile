import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { CustomTouchableOpacity } from '../../components/CustomTouchableOpacity';
import CurrentAddressScreen from '@/screens/Address/CurrentAddress';
import { RootNames } from '@/constant/layout';
import { RcIconHeaderAddAccount } from '@/assets/icons/home';
import ImportNewAddressScreen from '@/screens/Address/ImportNewAddress';
import { ImportSuccessScreen } from '../Address/ImportSuccessScreen';
import { ImportWatchAddressScreen } from '../Address/ImportWatchAddressScreen';
import AddressDetailScreen from '../Address/AddressDetail';
import { ImportMoreAddressScreen } from '../Address/ImportMoreAddressScreen';
import { ImportMoreAddressScreenButton } from '../Address/ImportMoreAddressScreenButton';
import { ImportSafeAddressScreen } from '../Address/ImportSafeAddressScreen';
import { ImportPrivateKeyScreen } from '../Address/ImportPrivateKeyScreen';
import { ScannerButton } from '../Address/ScannerButton';
import { ImportSeedPhraseScreen } from '../Address/ImportSeedPhraseScreen';
import { BackupPrivateKeyScreen } from '../Address/BackupPrivateKeyScreen';
import { CreateSeedPhraseRickCheckScreen } from '../Address/CreateSeedPhraseRiskCheckScreen';
import { CreateSeedPhraseBackupScreen } from '../Address/CreateSeedPhraseBackupScreen';
import { CreateSeedPhraseVerifyScreen } from '../Address/CreateSeedPhraseVerifyScreen';
import { BackSeedPhraseScreen } from '../Address/BackSeedPhraseScreen';
import { AddSeedPhraseScreen } from '../Address/AddSeedPhraseScreen/AddSeedPhraseScreen';
import { strings } from '@/utils/i18n';

const AddressStack = createCustomNativeStackNavigator();

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export function AddressNavigator() {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

  return (
    <AddressStack.Navigator
      screenOptions={{
        ...screenOptions,
        gestureEnabled: false,
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: 'transparent',
        },
        headerTintColor: colors['neutral-title-1'],
        headerTitleStyle: {
          color: colors['neutral-title-1'],
        },
        headerTitle: '',
      }}>
      <AddressStack.Screen
        name={RootNames.CurrentAddress}
        component={CurrentAddressScreen}
        options={({ navigation }) => ({
          headerTitle: 'Current Address',
          title: 'Current Address',
          headerRight: ({ tintColor }) => (
            <CustomTouchableOpacity
              hitSlop={hitSlop}
              onPress={() => {
                navigation.push(RootNames.StackAddress, {
                  screen: RootNames.ImportNewAddress,
                });
              }}>
              <RcIconHeaderAddAccount
                width={24}
                height={24}
                color={tintColor}
              />
            </CustomTouchableOpacity>
          ),
        })}
      />
      <AddressStack.Screen
        name={RootNames.ImportNewAddress}
        component={ImportNewAddressScreen}
        options={{
          headerTitle: 'Import New Address',
          title: 'Import New Address',
        }}
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
        name={RootNames.ImportWatchAddress}
        component={ImportWatchAddressScreen}
        options={{
          headerTintColor: colors['neutral-title-2'],
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportSafeAddress}
        component={ImportSafeAddressScreen}
        options={{
          headerTintColor: colors['neutral-title-2'],
        }}
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
            fontSize: 20,
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
            fontSize: 20,
          },
          headerRight: ScannerButton,
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportMnemonic}
        component={ImportSeedPhraseScreen}
        options={{
          headerTitle: 'Import Seed Phrase',
          title: 'Import Seed Phrase',
          headerTitleStyle: {
            fontSize: 20,
          },
          headerRight: ScannerButton,
        }}
      />
      <AddressStack.Screen
        name={RootNames.CreateMnemonic}
        component={CreateSeedPhraseRickCheckScreen}
        options={{
          headerTitle: strings('page.newAddress.createNewSeedPhrase'),
          title: strings('page.newAddress.createNewSeedPhrase'),
          headerTitleStyle: {
            fontSize: 20,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.AddMnemonic}
        component={AddSeedPhraseScreen}
        options={{
          headerTitle: 'Add from Current Seed Phrase',
          title: 'Add from Current Seed Phrase',
          headerTitleStyle: {
            fontSize: 20,
          },
        }}
      />
      <AddressStack.Screen
        name={RootNames.CreateMnemonicBackup}
        component={CreateSeedPhraseBackupScreen}
        options={{
          headerTitle: 'Backup seed phrase',
          title: 'Backup seed phrase',
          headerTitleStyle: {
            fontSize: 20,
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
            fontSize: 20,
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
            fontSize: 20,
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
            fontSize: 20,
          },
        }}
      />
    </AddressStack.Navigator>
  );
}
