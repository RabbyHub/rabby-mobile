import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import { ExtractEventEmitters, ExtractMethods } from './types';

export interface Spec extends TurboModule {
  forceExitApp(): void;
  /**
   * @description try to set a file to not be backed up by iCloud
   * @param filePath
   */
  iosExcludeFileFromBackup(filePath: string): Promise<boolean>;
  // /**
  //  * @description try to set a directory's files(including files in subdirectories) to not be backed up by iCloud
  //  */
  // iosExcludeDirectoryFromBackup?(directoryPath: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNHelpers');

export type Methods = ExtractMethods<Spec>;

export type EventEmitterRecord = ExtractEventEmitters<Spec>;
