import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { TruncatedText } from './TruncatedText';

jest.mock('@/components/Typography', () => {
  const ReactNative = jest.requireActual('react-native');

  return {
    Text: ReactNative.Text,
  };
});

describe('TruncatedText', () => {
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    consoleLog.mockRestore();
  });

  it('reports non-truncated first layout and truncated repeated layout width', () => {
    const onTextLayout = jest.fn();
    const onTruncate = jest.fn();
    const { getByText } = render(
      <TruncatedText
        numberOfLines={1}
        text="Rabby Wallet"
        onTextLayout={onTextLayout}
        onTruncate={onTruncate}
      />,
    );
    const text = getByText('Rabby Wallet');
    const layoutEvent = {
      nativeEvent: {
        lines: [{ width: 120 }],
      },
    };

    fireEvent(text, 'textLayout', layoutEvent);
    fireEvent(text, 'textLayout', layoutEvent);

    expect(onTextLayout).toHaveBeenCalledTimes(2);
    expect(onTruncate).toHaveBeenNthCalledWith(1, false);
    expect(onTruncate).toHaveBeenNthCalledWith(2, true);
  });

  it('re-runs the probe when text changes', () => {
    const { getByText, rerender } = render(
      <TruncatedText numberOfLines={1} text="First" />,
    );

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(getByText('First ')).toBeTruthy();

    rerender(<TruncatedText numberOfLines={1} text="Second" />);
    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(getByText('Second ')).toBeTruthy();
  });
});
