import { View, StyleSheet, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createCustomNativeStackNavigator as createNativeStackNavigator } from '@/utils/CustomNativeStackNavigator';
import { colord } from 'colord';

import { ThemeColors } from '@/constant/theme';
import { FocusAwareStatusBar } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useStackScreenConfig } from '@/hooks/navigation';

const LoginStack = createNativeStackNavigator();

export default () => {
  const screenOptions = useStackScreenConfig();
  const colors = useThemeColors();

  // const users = useAllStoragedUsers();
  // const hasOtherValidAccount = useMemo(() => Object.keys(users).length > 0, [users]);

  return (
    <LoginStack.Navigator
      screenOptions={screenOptions}
      initialRouteName={'Welcome'}>
      <LoginStack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
    </LoginStack.Navigator>
  );
};

const WelcomeScreen = ({ navigation }: NativeStackScreenProps<any>) => {
  const styles = getStyle();

  return (
    <View style={styles.container}>
      <FocusAwareStatusBar backgroundColor="transparent" translucent />
      {/* <ImageBackground
        source={WelcomeImage}
        resizeMode="cover"
        style={styles.backgroundImage}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Stay Connected</Text>
        </View>
        <View style={styles.titleView}>
          <Text style={styles.title}>With</Text>
        </View>
        <Text style={styles.subtitle}>
          Keep connected with all the things you care about in the web3 world
        </Text>
      </ImageBackground> */}
    </View>
  );
};

const getStyle = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    backgroundImage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    titleWrap: {
      marginTop: 350,
      marginBottom: 8,
    },
    titleView: {
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: ThemeColors.light['blue-default'],
      textAlign: 'center',
    },
    yellowTitle: {
      fontSize: 32,
      marginBottom: Platform.OS === 'ios' ? -2 : 0,
      marginLeft: Platform.OS === 'ios' ? 4 : 6,
      fontWeight: '700',
      color: ThemeColors.light['blue-default'],
    },
    yellowImage: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '400',
      color: ThemeColors.light['blue-light-2'],
      width: 272,
      marginBottom: 48,
      textAlign: 'center',
    },
    statusBar: {
      backgroundColor: ThemeColors.light['blue-default'],
    },
    loginBtn: {
      width: 272,
      height: 56,
      backgroundColor: ThemeColors.light['blue-default'],
      borderRadius: 28,
      shadowColor: colord(ThemeColors.light['blue-default'])
        .alpha(0.4)
        .toHslString(),
      shadowOffset: {
        width: 0,
        height: 12,
      },
      shadowRadius: -8,
      shadowOpacity: 30,
      elevation: 30,
    },
    buttonTitle: {
      fontSize: 17,
      color: ThemeColors.light['neutral-title-1'],
      fontWeight: '700',
    },
  });
