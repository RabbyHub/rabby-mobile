import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export interface Spec extends TurboModule {
  blockScreen(): void;
  unblockScreen(): void;
  updateGenericPassword(
    username: string,
    value: string,
    options: { service: string; cloudSync?: boolean; accessGroup?: string },
  ): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('ReactNativeSecurity');

export type Methods = ExtractMethods<Spec>;
