import { register } from 'react-native-bundle-splitter';

export { register as registerLazyComponent };

type RegisterSharedConfig = {
  cached?: boolean;
  group?: string;
  name?: string;
  placeholder?: React.SuspenseProps['fallback'];
  static?: object;
};

type RegisterDefaultExportConfig<
  T extends React.ComponentType<any>,
  M extends { default: T },
> = RegisterSharedConfig & {
  loader: () => Promise<M>;
};

type RegisteredAppScreen<T extends React.ComponentType<any>> =
  React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.ComponentProps<T>> &
      React.RefAttributes<unknown>
  >;

export function registerAppScreen<
  T extends React.ComponentType<any>,
  M extends { default: T },
>(config: RegisterDefaultExportConfig<T, M>): RegisteredAppScreen<T>;
export function registerAppScreen<T extends React.ComponentType<any>>(
  config: RegisterDefaultExportConfig<T, { default: T }>,
): RegisteredAppScreen<T>;
export function registerAppScreen<T extends React.ComponentType<any>>(
  config: RegisterDefaultExportConfig<T, { default: T }>,
) {
  return register<React.ComponentProps<T>>(
    config as Parameters<typeof register>[0],
  );
}
