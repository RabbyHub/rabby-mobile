import Reactotron from 'reactotron-react-native';

declare global {
  interface Console {
    tron?: typeof Reactotron;
  }
}

// if (__DEV__) {
//   Reactotron.configure({
//     getClientId: async () => `RabbyMobileThread`,
//     name: 'Rabby Mobile Thread',
//   })
//     .useReactNative()
//     .connect();

//   console.tron = Reactotron;
// }
