import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { openapi } from '@/core/request';
import {
  debugShowSubmitFeedbackByScreenshotModal,
  useSubmitFeedbackOnScreenshot,
} from '../hooks';
import { getScreenshotFeedbackExtra } from '../utils';
import {
  SHARE_ADDRESS_CHECKBOX_TEST_ID,
  ScreenshotFeedbackShareAddressCheckbox,
} from './ShareAddressCheckbox';

// Component coverage of the opt-in checkbox with the real screenshot feedback
// store. The extra builder, upload and request are mocked process boundaries;
// the payload rules themselves are covered in ../utils.test.ts.
jest.mock('@/core/native/RNScreenshotPrevent', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@/core/native/utils', () => ({ IS_IOS: true, IS_ANDROID: false }));
jest.mock('@/core/storage/fs', () => ({
  appScreenshotFS: {},
  AppScreenshotFS: {
    uploadFile: jest.fn(async () => ({ image_url: 'https://img.test/1.png' })),
  },
}));
jest.mock('@rabby-wallet/react-native-fs', () => ({}));
jest.mock('@/core/request', () => ({
  openapi: { postClientFeedbackMessage: jest.fn(async () => ({})) },
}));
jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: (_key: string, initial: object) =>
    require('zustand').create(() => initial),
}));
jest.mock('@/core/storage/mmkvConstants', () => ({ APP_MMKV_WEAK_KEYS: {} }));
jest.mock('@/constant', () => ({ isNonPublicProductionEnv: false }));
jest.mock('../utils', () => ({
  getScreenshotFeedbackExtra: jest.fn(async () => ({ appVersion: '1.0.0' })),
}));
jest.mock('@/hooks/native/security', () => ({
  getGlobalScreenCapturable: () => true,
}));
jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
}));
jest.mock('@/core/utils/device', () => ({ isGteAndroid: () => true }));
jest.mock('@/core/utils/perf', () => ({
  perfEvents: { subscribe: jest.fn() },
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: {},
  getVisibleBlockingModalIds: () => [],
  subscribeModalGateDebugSnapshot: jest.fn(),
}));
jest.mock('@/core/apis/device', () => ({
  makeDeviceUUID: () => ({ deviceUUID: 'device-1' }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (ctx: object) => object }) => {
    const colors2024 = {
      'green-default': 'green',
      'neutral-info': 'gray',
      'neutral-secondary': 'gray',
    };
    return { styles: getStyle({ colors2024, isLight: true }), colors2024 };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/assets2024/icons/common/checkbox-round-checked-cc.svg', () => {
  const { View } = require('react-native');
  return () => require('react').createElement(View, { testID: 'checked' });
});
jest.mock('@/assets2024/icons/common/checkbox-round-empty-cc.svg', () => {
  const { View } = require('react-native');
  return () => require('react').createElement(View, { testID: 'unchecked' });
});

const getExtra = jest.mocked(getScreenshotFeedbackExtra);
const postFeedback = jest.mocked(openapi.postClientFeedbackMessage);

type SubmitApi = ReturnType<typeof useSubmitFeedbackOnScreenshot>;
let submitApi: SubmitApi;

// One render tree: a second renderer (renderHook) stops RNTL from dispatching
// presses into the first one.
function Harness() {
  submitApi = useSubmitFeedbackOnScreenshot();
  return <ScreenshotFeedbackShareAddressCheckbox />;
}

function openSubmitModal() {
  act(() => {
    debugShowSubmitFeedbackByScreenshotModal();
  });
}

function renderOpenModal() {
  openSubmitModal();
  const view = render(<Harness />);
  const checkbox = () => view.getByTestId(SHARE_ADDRESS_CHECKBOX_TEST_ID);
  const isChecked = () => checkbox().props.accessibilityState?.checked;
  return { view, checkbox, isChecked };
}

describe('ScreenshotFeedbackShareAddressCheckbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => submitApi?.closeSubmitModal());
  });

  it('starts unchecked and submits without addresses by default', async () => {
    const { view, isChecked } = renderOpenModal();

    expect(view.getByText('component.screenshotModal.includeAddress'));
    expect(isChecked()).toBe(false);
    expect(view.getByTestId('unchecked')).toBeTruthy();

    await act(async () => {
      await submitApi.submitFeedbackByScreenshot();
    });

    expect(getExtra).toHaveBeenCalledWith(
      expect.objectContaining({ includeAddress: false }),
    );
    expect(postFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ extra: { appVersion: '1.0.0' } }),
    );
  });

  it('passes the opt-in to the feedback payload once checked', async () => {
    const { view, checkbox, isChecked } = renderOpenModal();

    fireEvent.press(checkbox());

    expect(isChecked()).toBe(true);
    expect(view.getByTestId('checked')).toBeTruthy();

    await act(async () => {
      await submitApi.submitFeedbackByScreenshot();
    });

    expect(getExtra).toHaveBeenCalledWith(
      expect.objectContaining({ includeAddress: true }),
    );
  });

  it('resets the opt-in every time the modal closes or reopens', () => {
    const { checkbox, isChecked } = renderOpenModal();

    fireEvent.press(checkbox());
    expect(isChecked()).toBe(true);

    act(() => submitApi.closeSubmitModal({ clearText: false }));
    expect(isChecked()).toBe(false);

    openSubmitModal();
    fireEvent.press(checkbox());
    expect(isChecked()).toBe(true);

    openSubmitModal();
    expect(isChecked()).toBe(false);
  });
});
