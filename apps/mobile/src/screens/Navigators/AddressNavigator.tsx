import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { CustomTouchableOpacity } from '../../components/CustomTouchableOpacity';
import CurrentAddressScreen from '@/screens/Address/CurrentAddress';
import { RootNames } from '@/constant/layout';
import {
  RcIconHeaderAddAccount,
  RcIconHeaderSettings,
} from '@/assets/icons/home';
import ImportNewAddressScreen from '@/screens/Address/ImportNewAddress';
import { ImportSuccessScreen } from '../Address/ImportSuccessScreen';
import { ImportWatchAddressScreen } from '../Address/ImportWatchAddressScreen';
import AddressDetailScreen from '../Address/AddressDetail';
import { ImportLedgerScreen } from '../Address/ImportLedger';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';

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
        name={RootNames.AddressDetail}
        component={AddressDetailScreen}
        options={{
          headerTitle: 'Address detail',
          title: 'Address detail',
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportLedger}
        component={ImportLedgerScreen}
        options={{
          headerTitle: 'Import more address',
          headerTitleStyle: {
            fontSize: 20,
          },
          title: 'Import more address',
          // eslint-disable-next-line react/no-unstable-nested-components
          headerRight: ({ tintColor }) => (
            <CustomTouchableOpacity
              hitSlop={hitSlop}
              onPress={() => {
                const id = createGlobalBottomSheetModal({
                  name: MODAL_NAMES.SETTING_LEDGER,
                  onDone: () => {
                    removeGlobalBottomSheetModal(id);
                  },
                });
              }}>
              <RcIconHeaderSettings width={24} height={24} color={tintColor} />
            </CustomTouchableOpacity>
          ),
        }}
      />
    </AddressStack.Navigator>
  );
}
