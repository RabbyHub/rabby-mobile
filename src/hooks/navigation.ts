import {useCallback} from 'react';
// import { StyleSheet } from 'react-native';
import {NativeStackNavigationOptions} from '@react-navigation/native-stack';
import {useThemeColors} from '@/hooks/theme';
import {navigationRef} from '@/utils/navigation';
// import { IconBack } from '@/assets/icons';
// import { CustomTouchableOpacity } from '@/components';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const useStackScreenConfig = (): NativeStackNavigationOptions => {
  const colors = useThemeColors();

  const navBack = useCallback(() => {
    const navigation = navigationRef.current;
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else {
      navigationRef.resetRoot({
        index: 0,
        routes: [{name: 'Root'}],
      });
    }
  }, []);

  return {
    animation: 'slide_from_right',
    contentStyle: {
      // backgroundColor: colors.bgChat,
    },
    headerTitleAlign: 'center' as const,
    headerStyle: {
      backgroundColor: 'transparent',
    },
    headerTransparent: true,
    headerBackVisible: false,
    headerTintColor: colors['neutral-bg-1'],
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 17,
    },
    // headerLeft: ({ tintColor }) => (
    //   <CustomTouchableOpacity style={styles.backButtonStyle} hitSlop={hitSlop} onPress={navBack}>
    //     <IconBack width={24} height={24} color={tintColor} />
    //   </CustomTouchableOpacity>
    // ),
  };
};

// const styles = StyleSheet.create({
//   headerTitleStyle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//   },
//   backButtonStyle: {
//     // width: 56,
//     // height: 56,
//     alignItems: 'center',
//     flexDirection: 'row',
//     marginLeft: -16,
//     paddingLeft: 16,
//   },
// });
