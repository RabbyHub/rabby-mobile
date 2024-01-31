import React from 'react';

import { useStackScreenConfig } from '@/hooks/navigation';
import { useThemeColors } from '@/hooks/theme';
import { createCustomNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';

import { CustomTouchableOpacity } from '../../components/CustomTouchableOpacity';
import { navigate } from '@/utils/navigation';
import CurrentAddressScreen from '@/screens/Address/CurrentAddress';
import { RootNames } from '@/constant/layout';
import { RcIconHeaderAddAccount } from '@/assets/icons/home';
import ImportNewAddressScreen from '@/screens/Address/ImportNewAddress';
import { ImportSuccessScreen } from '../Address/ImportSuccessScreen';
import { ImportWatchAddressScreen } from '../Address/ImportWatchAddressScreen';
import AddressDetailScreen from '../Address/AddressDetail';

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
        options={{
          headerTitle: 'Current Address',
          title: 'Current Address',
          headerRight: ({ tintColor }) => (
            <CustomTouchableOpacity
              hitSlop={hitSlop}
              onPress={() => {
                navigate(RootNames.StackAddress, {
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
        }}
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
        //@ts-ignore
        component={AddressDetailScreen}
        options={{
          headerTitle: 'Address detail',
          title: 'Address detail',
        }}
      />
    </AddressStack.Navigator>
  );
}
