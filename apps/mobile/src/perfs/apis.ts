import { register } from 'react-native-bundle-splitter';

export { register as registerLazyComponent };

export function registerAppScreen<T extends React.ComponentType<any>>(
  ...args: Parameters<typeof register>
) {
  return register<React.ComponentProps<T>>(...args);
}
