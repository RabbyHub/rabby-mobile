import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractMethods } from './types';

export type ShareFileOptions = {
  filePath: string;
  mimeType?: string;
  title?: string;
  subject?: string;
};

export interface Spec extends TurboModule {
  forceExitApp(): void;
  moveTaskToBack(): Promise<boolean>;
  shareFile(options: ShareFileOptions): Promise<void>;
  iosExcludeFileFromBackup(filePath: string): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>('RNHelpers');

export type Methods = ExtractMethods<Spec>;
