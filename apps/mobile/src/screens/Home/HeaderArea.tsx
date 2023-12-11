import React from 'react';
import { Text, View } from 'react-native';
import {
  RcIconHeaderSettings,
  RcIconHistory,
  RcIconHeaderAddAccount,
} from '@/assets/icons/home';
import { RootNames, ScreenColors, ScreenLayouts } from '@/constant/layout';
import { useThemeColors } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';

import TouchableView from '@/components/Touchable/TouchableView';

export default function HomeHeaderArea() {
  const colors = useThemeColors();

  const navigation = useNavigation();

  const handlePressCurrentAccount = React.useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.CurrentAddress,
      params: {},
    });
  }, []);

  const handlePressIcon = React.useCallback(
    (type: 'history' | 'settings' | 'add-account') => {
      switch (type) {
        default:
          break;
        case 'settings': {
          navigation.push(RootNames.StackSettings, {
            screen: RootNames.Settings,
            params: {},
          });
          break;
        }
        case 'add-account': {
          navigation.push(RootNames.StackAddress, {
            screen: RootNames.ImportNewAddress,
            params: {},
          });
          break;
        }
        case 'history': {
          navigation.push(RootNames.StackTransaction, {
            screen: RootNames.History,
            params: {},
          });
          break;
        }
      }
    },
    [navigation],
  );

  return (
    <View
      style={{
        height: ScreenLayouts.headerAreaHeight,
        backgroundColor: ScreenColors.homeHeaderBlue,
        marginLeft: -20,
        marginRight: -20,
      }}>
      <View
        style={{
          paddingLeft: 20,
          paddingRight: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
        <TouchableView
          style={{
            // width: 255,
            // width: '100%',
            flexShrink: 1,
            padding: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 6,
            backgroundColor: 'rgba(255, 255, 255, 0.10)',
          }}
          onPress={handlePressCurrentAccount}>
          <Text
            style={{
              color: colors['neutral-title-2'],
              fontFamily: 'SF Pro',
              fontSize: 16,
              fontStyle: 'normal',
              fontWeight: '500',
            }}>
            Left Account Switcher
          </Text>
        </TouchableView>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 38,
            flexShrink: 0,
          }}>
          <TouchableView
            style={{
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => handlePressIcon('history')}>
            <RcIconHistory />
          </TouchableView>
          <RcIconHeaderSettings
            style={{ marginLeft: 16 }}
            onPress={() => handlePressIcon('settings')}
          />
        </View>
      </View>
    </View>
  );
}
