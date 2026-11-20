import { renderHook } from '@testing-library/react-native';
import { promptLocalStorageArchiveShare } from '@/utils/promptLocalStorageArchive';
import { useLocalStorageArchiveGesture } from './useLocalStorageArchiveGesture';

jest.mock('@/constant/env', () => ({ IS_LOCAL_STORAGE_EXPORT_ENABLED: true }));
jest.mock('@/utils/promptLocalStorageArchive', () => ({
  promptLocalStorageArchiveShare: jest.fn(),
}));
const environment = jest.requireMock('@/constant/env');

describe('hidden local storage export gesture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(environment, { IS_LOCAL_STORAGE_EXPORT_ENABLED: true });
    jest.spyOn(Date, 'now').mockReturnValue(1000);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([10, 20])(
    'requires %s rapid taps and resets after opening the prompt',
    tapCount => {
      const { result } = renderHook(() =>
        useLocalStorageArchiveGesture(tapCount),
      );
      for (let i = 0; i < tapCount - 1; i += 1) {
        result.current();
      }
      expect(promptLocalStorageArchiveShare).not.toHaveBeenCalled();
      result.current();
      expect(promptLocalStorageArchiveShare).toHaveBeenCalledTimes(1);
      result.current();
      expect(promptLocalStorageArchiveShare).toHaveBeenCalledTimes(1);
    },
  );

  it('resets after a pause longer than 500 ms', () => {
    const { result } = renderHook(() => useLocalStorageArchiveGesture(10));
    for (let i = 0; i < 9; i += 1) {
      result.current();
    }
    jest.mocked(Date.now).mockReturnValue(1501);
    result.current();
    expect(promptLocalStorageArchiveShare).not.toHaveBeenCalled();
  });

  it('does nothing when export is disabled in this build', () => {
    Object.assign(environment, { IS_LOCAL_STORAGE_EXPORT_ENABLED: false });
    const { result } = renderHook(() => useLocalStorageArchiveGesture(10));
    for (let i = 0; i < 30; i += 1) {
      result.current();
    }
    expect(promptLocalStorageArchiveShare).not.toHaveBeenCalled();
  });
});
