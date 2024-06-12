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
import { ImportHardwareScreen } from '../Address/ImportHardwareScreen';
import { ImportHardwareScreenButton } from '../Address/ImportHardwareScreenButton';
import { ImportSafeAddressScreen } from '../Address/ImportSafeAddressScreen';
import { ImportPrivateKeyScreen } from '../Address/ImportPrivateKeyScreen';
import { ScannerButton } from '../Address/ScannerButton';
import { ImportSeedPhraseScreen } from '../Address/ImportSeedPhraseScreen';
import { BackupPrivateKeyScreen } from '../Address/BackupPrivateKeyScreen';
import { CreateSeedPhraseRickCheckScreen } from '../Address/CreateSeedPhraseRiskCheckScreen';
import { CreateSeedPhraseBackupScreen } from '../Address/CreateSeedPhraseBackupScreen';
import { CreateSeedPhraseVerifyScreen } from '../Address/CreateSeedPhraseVerifyScreen';

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
        name={RootNames.ImportHardware}
        component={ImportHardwareScreen}
        options={{
          headerTitle: 'Import more address',
          headerTitleStyle: {
            fontSize: 20,
          },
          title: 'Import more address',
          headerRight: ImportHardwareScreenButton,
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
          headerTitle: 'Create New Seed Phrase',
          title: 'Create New Seed Phrase',
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
    </AddressStack.Navigator>
  );
}
