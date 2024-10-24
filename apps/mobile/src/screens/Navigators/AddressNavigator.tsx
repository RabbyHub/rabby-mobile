import 'react-native-gesture-handler';
import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { CustomTouchableOpacity } from '../../components/CustomTouchableOpacity';
import CurrentAddressScreen from '@/screens/Address/CurrentAddress';
import { DEFAULT_NAVBAR_FONT_SIZE, RootNames } from '@/constant/layout';
import { RcIconHeaderAddAccount } from '@/assets/icons/home';
import ImportNewAddressScreen from '@/screens/Address/ImportNewAddress';
import { ImportSuccessScreen } from '../Address/ImportSuccessScreen';
import { ImportWatchAddressScreen } from '../Address/ImportWatchAddressScreen';
import AddressDetailScreen from '../Address/AddressDetail';
import { ImportMoreAddressScreen } from '../Address/ImportMoreAddressScreen';
import { ImportMoreAddressScreenButton } from '../Address/ImportMoreAddressScreenButton';
import { ImportSafeAddressScreen } from '../Address/ImportSafeAddressScreen';
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

const AddressStack = createCustomNativeStackNavigator();

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export function AddressNavigator() {
  const { mergeScreenOptions } = useStackScreenConfig();
  const colors = useThemeColors();
  // console.log('============== SettingNavigator Render =========');

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
        name={RootNames.CurrentAddress}
        component={CurrentAddressScreen}
        options={({ navigation }) => ({
          headerTitle: 'Current Address',
          title: 'Current Address',
          headerRight: ({ tintColor }) => (
            <CustomTouchableOpacity
              style={{
                borderRadius: 4,
                backgroundColor: colors['neutral-card-1'],
                paddingHorizontal: 6,
                paddingVertical: 4,
              }}
              hitSlop={hitSlop}
              onPress={() => {
                navigation.push(RootNames.StackAddress, {
                  screen: RootNames.ImportNewAddress,
                });
              }}>
              <RcIconHeaderAddAccount width={20} height={20} />
            </CustomTouchableOpacity>
          ),
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
