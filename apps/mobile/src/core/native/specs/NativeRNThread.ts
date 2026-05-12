import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export type ThreadStartOptions = {
  usePackedResource?: boolean;
};

export interface Spec extends TurboModule {
  readonly addListener: (eventType: string) => void;
  readonly removeListeners: (count: number) => void;

  startThread(jsFilePath: string, options?: ThreadStartOptions): Promise<number>;
  stopThread(threadId: number): void;
  postThreadMessage(threadId: number, message: string): void;
}

export default TurboModuleRegistry.get<Spec>('RNThread');

export type Methods = ExtractMethods<Spec>;
