import { NativeModules } from 'react-native';
import Reactotron from 'reactotron-react-native';
import { REACTOTRON_HOSTNAME as REACTOTRON_HOSTNAME_ } from '@env';
import { setupReactotronConnection } from '@/core/utils/devReactotron';

// import { AsyncStorage } from '@react-native-async-storage/async-storage';

if (__DEV__) {
  setTimeout(() => {
    setupReactotronConnection();
  }, 100);
}
