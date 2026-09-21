const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('@/components2024/Toast', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    positions: { CENTER: 0 },
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
  toastWithIcon: jest.fn(),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

import { showToast } from './showToast';

describe('showToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps existing managed Toast behavior when no lifecycle is requested', () => {
    showToast('done', 'success');

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'done',
      expect.objectContaining({
        onHidden: undefined,
        position: 0,
        standalone: false,
      }),
    );
  });

  it('keeps lifecycle Toasts standalone until their hidden callback runs', () => {
    const onHidden = jest.fn();
    showToast('done', 'success', { onHidden });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'done',
      expect.objectContaining({
        onHidden,
        position: 0,
        standalone: true,
      }),
    );
  });
});
