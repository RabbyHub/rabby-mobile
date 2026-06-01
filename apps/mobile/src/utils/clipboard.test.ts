const mockToastSuccess = jest.fn();
const mockGetTimeTip = jest.fn();
const mockClipboardSetString = jest.fn();
const mockClipboardGetString = jest.fn();
const mockDimensionsGet = jest.fn();
const mockT = jest.fn((key: string) => key);

jest.mock('@/components2024/Toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

jest.mock('@/constant', () => ({
  isNonPublicProductionEnv: false,
}));

jest.mock('@/hooks/appSettings', () => ({
  storeApiExpSettingData: {
    getTimeTipAboutSeedPhraseAndPrivateKey: (...args: unknown[]) =>
      mockGetTimeTip(...args),
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  getString: (...args: unknown[]) => mockClipboardGetString(...args),
  setString: (...args: unknown[]) => mockClipboardSetString(...args),
}));

jest.mock('i18next', () => ({
  t: (...args: unknown[]) => mockT(...args),
}));

jest.mock('react-native', () => ({
  Dimensions: {
    get: (...args: unknown[]) => mockDimensionsGet(...args),
  },
}));

import {
  isNewlyInputTextSameWithContentFromClipboard,
  onCopiedSensitiveData,
  onPastedSensitiveData,
  startCheckClearAction,
} from './clipboard';

describe('clipboard sensitive data helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockDimensionsGet.mockReturnValue({ height: 800, width: 400 });
    mockGetTimeTip.mockReturnValue('copy');
    mockClipboardGetString.mockResolvedValue('');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('shows a seed phrase copy toast and schedules clipboard clearing', () => {
    onCopiedSensitiveData({ type: 'seedPhrase' });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'global.toast.clipboard.copiedSeedPhrase',
      {
        position: 400,
      },
    );
    expect(mockClipboardSetString).not.toHaveBeenCalled();
  });

  it('shows a private-key copy toast with caller toast overrides', () => {
    onCopiedSensitiveData({
      type: 'privateKey',
      toastOptions: {
        position: 123,
        duration: 10,
      },
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'global.toast.clipboard.copiedPrivateKey',
      {
        position: 123,
        duration: 10,
      },
    );
  });

  it('does nothing for copy events when the setting is not copy mode', () => {
    mockGetTimeTip.mockReturnValue('pasted');

    onCopiedSensitiveData({ type: 'privateKey' });

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockClipboardSetString).not.toHaveBeenCalled();
  });

  it('clears the clipboard and shows a pasted-and-cleared toast in pasted mode', () => {
    mockGetTimeTip.mockReturnValue('pasted');

    onPastedSensitiveData({
      type: 'seedPhrase',
      toastOptions: {
        duration: 20,
      },
    });

    expect(mockClipboardSetString).toHaveBeenCalledWith('');
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'global.toast.clipboard.pasted_and_cleared',
      {
        position: 400,
        duration: 20,
      },
    );
  });

  it('does nothing for paste events when the setting is not pasted mode', () => {
    mockGetTimeTip.mockReturnValue('copy');

    onPastedSensitiveData({ type: 'privateKey' });

    expect(mockClipboardSetString).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('clears copied sensitive data on the periodic clear action', () => {
    mockGetTimeTip.mockReturnValue('copy');

    startCheckClearAction();
    onCopiedSensitiveData({ type: 'privateKey' });
    jest.advanceTimersByTime(30_000);

    expect(mockClipboardSetString).toHaveBeenCalledWith('');
  });

  it('skips periodic clearing when copy mode is disabled before the interval fires', () => {
    mockGetTimeTip.mockReturnValueOnce('copy');

    startCheckClearAction();
    onCopiedSensitiveData({ type: 'privateKey' });
    mockGetTimeTip.mockReturnValue('off');
    jest.advanceTimersByTime(30_000);

    expect(mockClipboardSetString).not.toHaveBeenCalled();
  });

  it('compares new input text with current clipboard content', async () => {
    mockClipboardGetString.mockResolvedValueOnce('secret');

    await expect(
      isNewlyInputTextSameWithContentFromClipboard('secret'),
    ).resolves.toBe(true);

    mockClipboardGetString.mockResolvedValueOnce('different');

    await expect(
      isNewlyInputTextSameWithContentFromClipboard('secret'),
    ).resolves.toBe(false);
  });
});
