import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export interface Spec extends TurboModule {
  blockScreen(): void;
  unblockScreen(): void;
  openSecurePreferencesKey(stage: boolean): Promise<string>;
  commitSecurePreferencesKey(storagePath: string): Promise<void>;
  computeSecurePreferenceHmac(message: string): string;
}

export default TurboModuleRegistry.get<Spec>('ReactNativeSecurity');

export type Methods = ExtractMethods<Spec>;
