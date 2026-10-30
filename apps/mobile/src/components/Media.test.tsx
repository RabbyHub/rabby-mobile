import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import RNFS, { type SafeSvgResult } from '@rabby-wallet/react-native-fs';

import { Media } from './Media';

jest.mock('@rabby-wallet/react-native-fs', () => ({
  __esModule: true,
  default: {
    isSafeSvgRasterizationAvailable: jest.fn(() => true),
    resolveSvg: jest.fn(),
  },
}));

jest.mock('react-native-fast-image', () => {
  const mockReact = require('react');
  const { View: MockView } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) =>
      mockReact.createElement(MockView, { testID: 'media-image', ...props }),
  };
});

jest.mock('react-native-video', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@rneui/themed', () => {
  const mockReact = require('react');
  const { View: MockView } = require('react-native');
  return {
    Skeleton: (props: any) =>
      mockReact.createElement(MockView, { testID: 'media-skeleton', ...props }),
  };
});

jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => ({ 'neutral-bg-1': '#fff' }),
}));

jest.mock('@/assets/icons/nft', () => ({ IconPlay: () => null }));

jest.mock('./CustomTouchableOpacity', () => ({
  CustomTouchableOpacity: require('react-native').TouchableOpacity,
}));

const SVG_URL = 'https://static.debank.com/image/nft/logo.svg';
const SECOND_SVG_URL = 'https://static.debank.com/image/nft/second.svg';
const PNG_URI = 'file:///safe-media/logo.png';
const FAILED_PLACEHOLDER = <View testID="failed-placeholder" />;
const STATIC_PLACEHOLDER = <View testID="static-placeholder" />;

const deferredResult = () => {
  let resolve!: (result: SafeSvgResult) => void;
  const promise = new Promise<SafeSvgResult>(onResolve => {
    resolve = onResolve;
  });
  return { promise, resolve };
};

const readyResult = (uri = PNG_URI): SafeSvgResult => ({
  status: 'ready',
  uri,
  width: 64,
  height: 64,
  cacheHit: false,
});

describe('Media SVG loading presentation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(RNFS.isSafeSvgRasterizationAvailable).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('uses the opted-in static placeholder instead of a pulsing skeleton while pending', () => {
    const pending = deferredResult();
    jest.mocked(RNFS.resolveSvg).mockReturnValue(pending.promise);
    const view = render(
      <Media
        src={SVG_URL}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={STATIC_PLACEHOLDER}
      />,
    );

    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(view.queryByTestId('media-image')).toBeNull();
    const loadingOverlay = view
      .UNSAFE_getAllByType(View)
      .find(node => node.props.pointerEvents === 'none');
    expect(loadingOverlay).toBeDefined();
    expect(StyleSheet.flatten(loadingOverlay?.props.style)).toEqual(
      expect.objectContaining({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }),
    );
    expect(RNFS.resolveSvg).toHaveBeenCalledWith({
      url: SVG_URL,
      variant: 'thumbnail',
    });

    act(() => jest.advanceTimersByTime(1500));

    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
  });

  it('keeps the same static fallback when SVG conversion fails', async () => {
    const pending = deferredResult();
    const handleError = jest.fn();
    jest.mocked(RNFS.resolveSvg).mockReturnValue(pending.promise);
    const view = render(
      <Media
        src={SVG_URL}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={STATIC_PLACEHOLDER}
        handleError={handleError}
      />,
    );

    await act(async () => {
      pending.resolve({ status: 'failed', reason: 'invalid_svg' });
      await pending.promise;
    });

    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(view.queryByTestId('media-image')).toBeNull();
    expect(handleError).toHaveBeenCalledTimes(1);
  });

  it('renders the converted PNG and removes the static loading placeholder after image load', async () => {
    const pending = deferredResult();
    const handleSuccess = jest.fn();
    jest.mocked(RNFS.resolveSvg).mockReturnValue(pending.promise);
    const view = render(
      <Media
        src={SVG_URL}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={FAILED_PLACEHOLDER}
        handleSuccess={handleSuccess}
      />,
    );

    await act(async () => {
      pending.resolve(readyResult());
      await pending.promise;
    });

    const image = view.getByTestId('media-image');
    expect(image.props.source).toEqual({ uri: PNG_URI });
    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    fireEvent(image, 'load');

    expect(view.queryByTestId('static-placeholder')).toBeNull();
    expect(view.queryByTestId('failed-placeholder')).toBeNull();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(handleSuccess).toHaveBeenCalledTimes(1);
  });

  it('preserves the default pulse and 1500ms loading timeout for non-opted-in SVG media', () => {
    const pending = deferredResult();
    jest.mocked(RNFS.resolveSvg).mockReturnValue(pending.promise);
    const view = render(
      <Media src={SVG_URL} failedPlaceholder={FAILED_PLACEHOLDER} />,
    );

    expect(view.getByTestId('media-skeleton').props.animation).toBe('pulse');
    expect(view.queryByTestId('failed-placeholder')).toBeNull();
    act(() => jest.advanceTimersByTime(1499));
    expect(view.getByTestId('media-skeleton')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1));
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(view.getByTestId('failed-placeholder')).toBeTruthy();
  });

  it('leaves ordinary raster images on the direct image path', () => {
    const uri = 'https://static.debank.com/image/nft/logo.png';
    const view = render(
      <Media
        src={uri}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={FAILED_PLACEHOLDER}
      />,
    );

    expect(view.getByTestId('media-image').props.source).toEqual({ uri });
    expect(view.queryByTestId('static-placeholder')).toBeNull();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(RNFS.resolveSvg).not.toHaveBeenCalled();
  });

  it('keeps the placeholder static when a fallback URL remounts the image', () => {
    const primary = deferredResult();
    const fallback = deferredResult();
    jest
      .mocked(RNFS.resolveSvg)
      .mockReturnValueOnce(primary.promise)
      .mockReturnValueOnce(fallback.promise);
    const view = render(
      <View>
        <Media
          key={SVG_URL}
          src={SVG_URL}
          loadingPlaceholder={STATIC_PLACEHOLDER}
          failedPlaceholder={STATIC_PLACEHOLDER}
        />
      </View>,
    );
    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-skeleton')).toBeNull();

    view.rerender(
      <View>
        <Media
          key={SECOND_SVG_URL}
          src={SECOND_SVG_URL}
          loadingPlaceholder={STATIC_PLACEHOLDER}
          failedPlaceholder={STATIC_PLACEHOLDER}
        />
      </View>,
    );
    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(RNFS.resolveSvg).toHaveBeenCalledTimes(2);
  });

  it('still renders a PNG that resolves after the placeholder timeout', async () => {
    const pending = deferredResult();
    const handleSuccess = jest.fn();
    jest.mocked(RNFS.resolveSvg).mockReturnValue(pending.promise);
    const view = render(
      <Media
        src={SVG_URL}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={STATIC_PLACEHOLDER}
        handleSuccess={handleSuccess}
      />,
    );
    act(() => jest.advanceTimersByTime(1500));
    expect(view.getByTestId('static-placeholder')).toBeTruthy();
    expect(view.queryByTestId('media-image')).toBeNull();

    await act(async () => {
      pending.resolve(readyResult());
      await pending.promise;
    });

    const image = view.getByTestId('media-image');
    expect(image.props.source).toEqual({ uri: PNG_URI });
    fireEvent(image, 'load');
    expect(view.queryByTestId('static-placeholder')).toBeNull();
    expect(view.queryByTestId('media-skeleton')).toBeNull();
    expect(handleSuccess).toHaveBeenCalledTimes(1);
  });

  it('ignores an old SVG response after the image source changes', async () => {
    const previous = deferredResult();
    const current = deferredResult();
    jest
      .mocked(RNFS.resolveSvg)
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const view = render(
      <Media
        src={SVG_URL}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={FAILED_PLACEHOLDER}
      />,
    );
    view.rerender(
      <Media
        src={SECOND_SVG_URL}
        loadingPlaceholder={STATIC_PLACEHOLDER}
        failedPlaceholder={FAILED_PLACEHOLDER}
      />,
    );

    await act(async () => {
      previous.resolve(readyResult('file:///safe-media/stale.png'));
      await previous.promise;
    });
    expect(view.queryByTestId('media-image')).toBeNull();

    await act(async () => {
      current.resolve(readyResult());
      await current.promise;
    });
    expect(view.getByTestId('media-image').props.source).toEqual({
      uri: PNG_URI,
    });
  });
});
