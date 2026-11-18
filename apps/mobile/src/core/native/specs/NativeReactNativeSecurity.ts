import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export interface Spec extends TurboModule {
  blockScreen(): void;
  unblockScreen(): void;
  openSecurePreferencesKey(create: boolean): Promise<string>;
  computeSecurePreferenceHmac(message: string): string;
}

export default TurboModuleRegistry.get<Spec>('ReactNativeSecurity');

export type Methods = ExtractMethods<Spec>;
