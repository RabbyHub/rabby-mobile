import { themeColorsNext2024 } from '@rabby-wallet/base-utils/src/isomorphic/theme-colors';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeColorMap = (typeof themeColorsNext2024)[ThemeMode];

function getInitialThemeMode(): ThemeMode {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

function useSystemThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      setThemeMode(event.matches ? 'dark' : 'light');
    };

    setThemeMode(mediaQuery.matches ? 'dark' : 'light');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  return themeMode;
}

export function usePanelTheme() {
  const themeMode = useSystemThemeMode();
  const themeColors = themeColorsNext2024[themeMode];

  const panelThemeStyle = useMemo(() => {
    return Object.fromEntries(
      Object.entries(themeColors).map(([key, value]) => [
        `--rf-color-${key}`,
        value,
      ]),
    ) as CSSProperties;
  }, [themeColors]);

  const antThemeConfig = useMemo<ThemeConfig>(() => {
    return {
      algorithm:
        themeMode === 'dark'
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: themeColors['brand-default'],
        colorInfo: themeColors['brand-default'],
        colorSuccess: themeColors['green-default'],
        colorWarning: themeColors['orange-default'],
        colorError: themeColors['red-default'],
        colorBgBase: themeColors['neutral-bg-0'],
        colorBgContainer: themeColors['neutral-bg-1'],
        colorBgElevated: themeColors['neutral-bg-2'],
        colorBorder: themeColors['neutral-line'],
        colorText: themeColors['neutral-title-1'],
        colorTextHeading: themeColors['neutral-title-1'],
        colorTextSecondary: themeColors['neutral-body'],
        colorTextDescription: themeColors['neutral-foot'],
        borderRadius: 14,
        fontSize: 12,
        controlHeight: 36,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      components: {
        Card: {
          colorBorderSecondary: themeColors['neutral-line'],
          headerBg: 'transparent',
        },
        Collapse: {
          headerBg: themeColors['neutral-bg-2'],
          contentBg: themeColors['neutral-bg-1'],
          borderlessContentBg: themeColors['neutral-bg-1'],
          colorTextHeading: themeColors['neutral-title-1'],
        },
        Input: {
          activeBorderColor: themeColors['brand-default'],
          hoverBorderColor: themeColors['brand-default'],
          activeShadow: 'none',
        },
        Button: {
          defaultBorderColor: themeColors['neutral-line'],
          defaultColor: themeColors['neutral-title-1'],
          defaultBg: themeColors['neutral-bg-1'],
        },
        Tabs: {
          inkBarColor: themeColors['brand-default'],
          itemColor: themeColors['neutral-foot'],
          itemHoverColor: themeColors['neutral-title-1'],
          itemSelectedColor: themeColors['neutral-title-1'],
        },
        Tag: {
          defaultBg: themeColors['neutral-bg-2'],
          defaultColor: themeColors['neutral-foot'],
        },
      },
    };
  }, [themeColors, themeMode]);

  return {
    themeMode,
    themeColors,
    panelThemeStyle,
    antThemeConfig,
  };
}
