import React from 'react';
import { act, render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { PerpsFundingHistoryOwner } from './PerpsFundingHistoryOwner';

const mockJournal = jest.fn();
let mockFocused = true;
let mockReady = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}));
jest.mock('@/hooks/perps/runtime/usePerpsRuntimeStatus', () => ({
  usePerpsRuntimeStatus: () => ({ status: mockReady ? 'ready' : 'pending' }),
}));
jest.mock('@/hooks/perps/funding/usePerpsFundingHistoryJournal', () => ({
  usePerpsFundingHistoryJournal: (options: unknown) => mockJournal(options),
}));

describe('Perps route funding owner', () => {
  const descriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  beforeEach(() => {
    mockFocused = true;
    mockReady = true;
    mockJournal.mockClear();
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (descriptor) {
      Object.defineProperty(AppState, 'currentState', descriptor);
    }
  });

  it('gates the single journal by runtime, route focus and foreground, not by mode', () => {
    let onChange: (state: AppStateStatus) => void = () => undefined;
    const remove = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        onChange = listener;
        return { remove };
      });
    const view = render(<PerpsFundingHistoryOwner />);
    expect(mockJournal).toHaveBeenLastCalledWith({ enabled: true });
    act(() => onChange('background'));
    expect(mockJournal).toHaveBeenLastCalledWith({ enabled: false });
    act(() => onChange('active'));
    mockFocused = false;
    view.rerender(<PerpsFundingHistoryOwner />);
    expect(mockJournal).toHaveBeenLastCalledWith({ enabled: false });
    mockFocused = true;
    mockReady = false;
    view.rerender(<PerpsFundingHistoryOwner />);
    expect(mockJournal).toHaveBeenLastCalledWith({ enabled: false });
    mockReady = true;
    view.rerender(<PerpsFundingHistoryOwner />);
    expect(mockJournal).toHaveBeenLastCalledWith({ enabled: true });
    view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
