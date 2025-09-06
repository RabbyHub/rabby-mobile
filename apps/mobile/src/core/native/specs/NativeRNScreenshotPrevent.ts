import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';
import { ExtractEventEmitters, ExtractMethods, TrimNeverValues } from './types';

export interface Spec extends TurboModule {
  togglePreventScreenshot: (isPrevent: boolean) => void;
  iosIsBeingCaptured(): boolean;
  // iosToggleBlurView(isProtected: boolean): void;
  iosProtectFromScreenRecording(): Promise<void>;
  iosUnprotectFromScreenRecording(): Promise<void>;

  /**
   * @platform iOS, Android >= 14
   */
  userDidTakeScreenshot: EventEmitter<{
    androidScanEmpty?: string;
    androidHasPermission?: boolean;
    captured?: boolean;
    path?: string;
    height?: string | number;
    width?: string | number;
    imageBase64?: string;
    imageType?: 'jpeg' | 'png';
    name?: string;
  }>;
  screenCapturedChanged: EventEmitter<{ isBeingCaptured: boolean }>;
  screenCaptureDetectionChanged: EventEmitter<{ enabled: boolean }>;
  /**
   * @description subscribe to android app state change, pause means app is in background, resume means app is in foreground
   */
  androidOnLifeCycleChanged: EventEmitter<{ state: 'resume' | 'pause' }>;
  /** @description pointless now */
  preventScreenshotChanged: EventEmitter<{
    isPrevent: boolean;
    success: boolean;
  }>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNScreenshotPrevent');

export type Methods = ExtractMethods<Spec>;

export type EventEmitterRecord = ExtractEventEmitters<Spec>;
