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

// Component coverage of the address checkbox with the real screenshot feedback
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
// Stands in for the MMKV-backed stores; exposes them so tests can read what
// would be saved, seed what a previous app session saved, and go back to the
// store's real defaults.
jest.mock('@/core/storage/mmkv', () => {
  const persistedStores = new Map<string, unknown>();
  const initialStates = new Map<string, object>();
  return {
    persistedStores,
    initialStates,
    zustandByMMKV: (key: string, initial: object) => {
      const store = require('zustand').create(() => initial);
      persistedStores.set(key, store);
      initialStates.set(key, initial);
      return store;
    },
  };
});
jest.mock('@/core/storage/mmkvConstants', () => ({
  APP_MMKV_WEAK_KEYS: { SCREENSHOT_FEEDBACK: 'screenshot-feedback' },
}));
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

type PersistedFeedbackStore = {
  getState: () => Record<string, unknown>;
  setState: (partial: Record<string, unknown>, replace?: boolean) => void;
};
const FEEDBACK_STORE_KEY = 'screenshot-feedback';
const mmkvMock = () =>
  jest.requireMock('@/core/storage/mmkv') as {
    persistedStores: Map<string, PersistedFeedbackStore>;
    initialStates: Map<string, Record<string, unknown>>;
  };
const persistedFeedbackStore = () =>
  mmkvMock().persistedStores.get(FEEDBACK_STORE_KEY)!;

function seedSavedChoice(includeAddress: unknown) {
  act(() => persistedFeedbackStore().setState({ includeAddress }));
}

/** Nothing saved yet: the store holds its real defaults. */
function resetToDefaults() {
  const initial = mmkvMock().initialStates.get(FEEDBACK_STORE_KEY)!;
  act(() => persistedFeedbackStore().setState({ ...initial }, true));
}

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
    resetToDefaults();
  });

  afterEach(() => {
    act(() => submitApi?.closeSubmitModal());
  });

  it('starts checked and submits with addresses by default', async () => {
    const { view, isChecked } = renderOpenModal();

    expect(
      view.getByText('component.screenshotModal.includeAddress'),
    ).toBeTruthy();
    expect(isChecked()).toBe(true);
    expect(view.getByTestId('checked')).toBeTruthy();

    await act(async () => {
      await submitApi.submitFeedbackByScreenshot();
    });

    expect(getExtra).toHaveBeenCalledWith({ includeAddress: true });
    expect(postFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ extra: { appVersion: '1.0.0' } }),
    );
  });

  it('submits without addresses once unchecked', async () => {
    const { view, checkbox, isChecked } = renderOpenModal();

    fireEvent.press(checkbox());

    expect(isChecked()).toBe(false);
    expect(view.getByTestId('unchecked')).toBeTruthy();

    await act(async () => {
      await submitApi.submitFeedbackByScreenshot();
    });

    expect(getExtra).toHaveBeenCalledWith({ includeAddress: false });
  });

  it('remembers the last choice across closing and reopening', () => {
    const { checkbox, isChecked } = renderOpenModal();

    fireEvent.press(checkbox());
    act(() => submitApi.closeSubmitModal());
    openSubmitModal();

    expect(isChecked()).toBe(false);
    expect(persistedFeedbackStore().getState().includeAddress).toBe(false);

    fireEvent.press(checkbox());
    act(() => submitApi.closeSubmitModal());
    openSubmitModal();

    expect(isChecked()).toBe(true);
    expect(persistedFeedbackStore().getState().includeAddress).toBe(true);
  });

  it('restores an unchecked choice saved by an earlier session', async () => {
    seedSavedChoice(false);
    const { isChecked } = renderOpenModal();

    expect(isChecked()).toBe(false);

    await act(async () => {
      await submitApi.submitFeedbackByScreenshot();
    });

    expect(getExtra).toHaveBeenCalledWith({ includeAddress: false });
  });

  it.each([undefined, null, 0])(
    'falls back to checked for a saved value of %p',
    async saved => {
      seedSavedChoice(saved);
      const { isChecked } = renderOpenModal();

      expect(isChecked()).toBe(true);

      await act(async () => {
        await submitApi.submitFeedbackByScreenshot();
      });

      expect(getExtra).toHaveBeenCalledWith({ includeAddress: true });
    },
  );
});
