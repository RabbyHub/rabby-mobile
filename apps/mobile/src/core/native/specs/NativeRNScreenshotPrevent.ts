import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';
import { ExtractEventEmitters, ExtractMethods } from './types';

export interface Spec extends TurboModule {
  readonly addListener: (eventType: string) => void;
  readonly removeListeners: (count: number) => void;

  scanScreenshotDirectory(): void;
  startScreenCaptureDetection(): Promise<void>;
  stopScreenCaptureDetection(): Promise<void>;
  togglePreventScreenshot(isPrevent: boolean): void;
  setAppSwitcherBlurEnabled(isEnabled: boolean): void;
  iosIsBeingCaptured(): boolean;
  iosProtectFromScreenRecording(): Promise<void>;
  iosUnprotectFromScreenRecording(): Promise<void>;

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
  appSwitcherBlurChanged: EventEmitter<{ visible: boolean }>;
  screenCaptureDetectionChanged: EventEmitter<{ enabled: boolean }>;
  androidOnLifeCycleChanged: EventEmitter<{ state: 'resume' | 'pause' }>;
  preventScreenshotChanged: EventEmitter<{
    isPrevent: boolean;
    success: boolean;
  }>;
}

export default TurboModuleRegistry.get<Spec>('RNScreenshotPrevent');

export type Methods = ExtractMethods<Spec>;
export type EventEmitterRecord = ExtractEventEmitters<Spec>;
