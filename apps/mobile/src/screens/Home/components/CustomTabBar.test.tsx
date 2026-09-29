import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { homeDrawerAnimateMutable } from '../hooks/useHomeDrawerAnimate';
import { HomeCustomMaterialTabBar } from './CustomTabBar';

// Component unit coverage: execute the real style callbacks at controlled
// inputs. This does not simulate Fabric mounting, native hit testing, animation
// timing, or PagerView settling; those need device validation.
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return {
    __esModule: true,
    default: { View: NativeView },
    // As in Reanimated's Jest mock, interpolation is not simulated. Assertions
    // below cover the overlay's real opacity and pointer gates, not indicator
    // geometry or the asset-label fade interpolation.
    interpolate: jest.fn(),
    Extrapolation: { CLAMP: 'clamp' },
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    makeMutable: (value: unknown) => ({ value }),
    withTiming: (value: unknown) => value,
    useAnimatedReaction: () => undefined,
  };
});

jest.mock('@/core/native/utils', () => ({ IS_ANDROID: true, IS_IOS: false }));
jest.mock('react-native-collapsible-tab-view', () => ({}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/navigation', () => ({
  apisHomeTabIndex: {
    svTabIndexDecimal: { value: 0 },
    svTabName: { value: 'overview' },
    setTabIndex: jest.fn(),
  },
  HomeTabName: {
    overview: 'overview',
    token: 'token',
    defi: 'defi',
    nft: 'nft',
  },
  TabbarLabels: {
    token: { index: 1, label: 'Tokens' },
    defi: { index: 2, label: 'DeFi' },
    nft: { index: 3, label: 'NFTs' },
  },
}));

// Keep the component's own static and animated style factories. The theme
// provider is outside this unit's boundary, not the style values under test.
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (
    input: { reanimatedStyles?: object } | (() => object),
    styles?: () => object,
  ) => ({
    getStyles: styles ?? input,
    getReanimatedStyles:
      typeof input === 'function' ? {} : input.reanimatedStyles ?? {},
  }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any = {}) => {
    const colors2024 = new Proxy({}, { get: () => '#123456' });
    const context = {
      colors2024,
      isLight: true,
      winLayout: { value: { width: 390, height: 844 } },
    };
    return {
      ...context,
      styles: getStyle?.getStyles(context) ?? {},
      reanimatedStyles: Object.fromEntries(
        Object.entries(getStyle?.getReanimatedStyles ?? {}).map(
          ([name, getAnimatedStyle]) => [
            name,
            () =>
              (getAnimatedStyle as (mockContext: object) => object)(context),
          ],
        ),
      ),
    };
  },
}));
jest.mock('@/components2024/Animations/HomeGuidanceMultipleTabs', () => ({
  useMeasureLayoutForHomeGuidanceMultipleTabs: () => ({
    secondaryIndicatorViewRef: { current: null },
    measureSecondaryIndicator: jest.fn(),
  }),
}));
jest.mock('../useChainInfo', () => ({
  useSelectedChainItem: () => undefined,
  useTop3Chains: () => [],
}));
jest.mock('./AssetRenderItems/SectionHeaders', () => ({
  ChainSelector: () => null,
}));
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: jest.fn(),
  removeGlobalBottomSheetModal2024: jest.fn(),
}));
jest.mock('./Tabs/CustomLabel', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return ({ text }: { text: string }) =>
    ReactModule.createElement(Text, {}, text);
});

function getOverlayStyle() {
  const overlay = screen.UNSAFE_getAllByType(View).find(node => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.position === 'absolute' &&
      style.top === HOME_TOP_HEADER_SIZES.headerHeight &&
      style.left === 0 &&
      style.right === 0
    );
  });
  expect(overlay).toBeDefined();
  return StyleSheet.flatten(overlay!.props.style);
}

function getAssetsRowStyle() {
  const row = screen.UNSAFE_getAllByType(View).find(node => {
    const style = StyleSheet.flatten(node.props.style);
    return (
      style?.flexDirection === 'row' &&
      style.paddingHorizontal === HOME_TOP_HEADER_SIZES.portfolioContainerPx
    );
  });
  expect(row).toBeDefined();
  return StyleSheet.flatten(row!.props.style);
}

describe('HomeCustomMaterialTabBar presentation contract', () => {
  beforeEach(() => {
    apisHomeTabIndex.svTabIndexDecimal.value = 0;
    homeDrawerAnimateMutable.tabsOpacity.value = 1;
  });

  it('keeps the overlay at one zIndex across Overview and asset pages', () => {
    const view = render(<HomeCustomMaterialTabBar />);

    for (const index of [0, 0.5, 1, 2, 3, 1, 0.5, 0]) {
      apisHomeTabIndex.svTabIndexDecimal.value = index;
      view.rerender(<HomeCustomMaterialTabBar />);

      expect(getOverlayStyle()).toMatchObject({
        zIndex: 10,
        opacity: 1,
        pointerEvents: 'box-none',
      });
      // Overview retains its two indicator controls instead of hiding the
      // whole overlay when index < 1.
      const indicatorControls = screen
        .UNSAFE_getAllByType(View)
        .filter(node => node.props.hitSlop?.top === 50);
      expect(indicatorControls).toHaveLength(2);
    }
  });

  it.each([0, 1])(
    'preserves drawer fading and disables the overlay below the hit threshold at index %s',
    index => {
      apisHomeTabIndex.svTabIndexDecimal.value = index;
      const view = render(<HomeCustomMaterialTabBar />);

      for (const opacity of [1, 0.5, 0.1, 0.099, 0, 1]) {
        homeDrawerAnimateMutable.tabsOpacity.value = opacity;
        view.rerender(<HomeCustomMaterialTabBar />);

        expect(getOverlayStyle()).toMatchObject({
          zIndex: 10,
          opacity,
          pointerEvents: opacity < 0.1 ? 'none' : 'box-none',
        });
      }
    },
  );

  it('keeps asset-row hit testing disabled until the asset page is reached', () => {
    const view = render(<HomeCustomMaterialTabBar />);

    for (const index of [0, 0.5, 0.999, 1, 2, 0]) {
      apisHomeTabIndex.svTabIndexDecimal.value = index;
      view.rerender(<HomeCustomMaterialTabBar />);

      expect(getAssetsRowStyle().pointerEvents).toBe(
        index < 1 ? 'none' : 'auto',
      );
    }
  });
});
