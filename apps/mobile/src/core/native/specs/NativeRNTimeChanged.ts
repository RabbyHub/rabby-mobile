import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';
import { ExtractEventEmitters, ExtractMethods } from './types';

export interface Spec extends TurboModule {
  readonly addListener: (eventType: string) => void;
  readonly removeListeners: (count: number) => void;

  exitAppForSecurity(): void;
  onTimeChanged: EventEmitter<{
    androidAction?: string;
    iosEvent?: string;
    reason: 'timeSet' | 'timeZoneChanged' | 'unknown';
  }>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNTimeChanged');

export type Methods = ExtractMethods<Spec>;

export type EventEmitterRecord = ExtractEventEmitters<Spec>;
