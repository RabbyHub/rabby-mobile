import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export type ShareFileOptions = {
  filePath: string;
  mimeType?: string;
  title?: string;
  subject?: string;
};

export type NativeBuildInfo = {
  BUILD_GIT_HASH?: string;
  BUILD_GIT_HASH_TIME?: string;
  BUILD_TIME?: string;
  BUILD_GIT_COMMITOR?: string;
  METRO_CACHE_ENABLED?: boolean;
};

export interface Spec extends TurboModule {
  getConstants(): { buildInfo?: NativeBuildInfo };
  forceExitApp(): void;
  androidTraceInstant(name: string): void;
  androidTraceBeginSection(name: string): void;
  androidTraceEndSection(): void;
  androidTraceBeginAsyncSection(name: string, cookie: number): void;
  androidTraceEndAsyncSection(name: string, cookie: number): void;
  androidTraceCounter(name: string, value: number): void;
  moveTaskToBack(): Promise<boolean>;
  shareFile(options: ShareFileOptions): Promise<void>;
  iosExcludeFileFromBackup(filePath: string): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('RNHelpers');

export type Methods = ExtractMethods<Spec>;
