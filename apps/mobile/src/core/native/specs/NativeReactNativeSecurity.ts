import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

import { ExtractEventEmitters, ExtractMethods } from './types';

export interface Spec extends TurboModule {
  /**
   * @description Blocks the screen
   */
  blockScreen(): void;
  /**
   * @description Unblocks the screen
   */
  unblockScreen(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeSecurity');

export type Methods = ExtractMethods<Spec>;

export type EventEmitterRecord = ExtractEventEmitters<Spec>;
