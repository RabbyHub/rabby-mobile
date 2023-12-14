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
        headerTitleStyle: {
          color: colors['neutral-title-1'],
          fontWeight: 'normal',
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
                navigate(RootNames.ImportNewAddress);
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
        // component={ImportSuccessScreen}
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
        }}
      />
      <AddressStack.Screen
        name={RootNames.ImportWatchAddress}
        component={ImportWatchAddressScreen}
      />
    </AddressStack.Navigator>
  );
}
