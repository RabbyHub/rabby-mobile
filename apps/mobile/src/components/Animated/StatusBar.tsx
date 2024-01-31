import { StatusBarProps } from 'react-native';
import { StatusBar, Platform } from 'react-native';
import Animated from 'react-native-reanimated';

const isIOS = Platform.OS === 'ios';

const AnimatedStatusBarComp = !isIOS
  ? Animated.createAnimatedComponent(StatusBar)
  : StatusBar;

function AndroidStatusBar(props: StatusBarProps) {
  useEffect(() => {
    Animated.timing(barColorAnim, {
      useNativeDriver: false,
      duration: 300,
      toValue: barStyle === 'light-content' ? 1 : 0,
    }).start();
  }, []);

  return (
    <AnimatedStatusBar
      animated={true}
      backgroundColor={barColor}
      barStyle={barStyle}
      translucent={true}
    />
  );
}

export default function AnimatedStatusBar(props: StatusBarProps) {
  if (isIOS) {
    return <StatusBar {...props} animated translucent={true} />;
  }

  return (
    <AnimatedStatusBarComp {...props} {...(isIOS && { translucent: true })} />
  );
}
