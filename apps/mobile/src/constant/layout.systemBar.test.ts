import { RootNames, getScreenSystemBarConfig } from './layout';
import { ThemeColors } from './theme';

describe('screen system bar configuration', () => {
  it('keeps the home screen transparent for edge-to-edge content', () => {
    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.Home,
        isDarkTheme: false,
      }),
    ).toEqual({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: 'transparent',
    });
  });

  it('keeps transparent screens transparent for edge-to-edge content', () => {
    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.WalletConnect,
        isDarkTheme: false,
      }),
    ).toEqual({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: 'transparent',
    });
  });

  it('keeps the gas account screen transparent for edge-to-edge content', () => {
    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.GasAccount,
        isDarkTheme: false,
      }),
    ).toEqual({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: 'transparent',
    });
  });

  it('keeps the perps entry screen transparent for its theme-specific background', () => {
    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.Perps,
        isDarkTheme: false,
      }),
    ).toEqual({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: 'transparent',
    });

    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.Perps,
        isDarkTheme: true,
      }),
    ).toEqual({
      statusBarStyle: 'light-content',
      statusBarBackgroundColor: 'transparent',
    });
  });

  it('keeps points, settings, and token detail screens transparent', () => {
    for (const isDarkTheme of [false, true]) {
      for (const screenName of [
        RootNames.Points,
        RootNames.Settings,
        RootNames.TokenDetail,
        RootNames.TokenMarketInfo,
      ]) {
        expect(
          getScreenSystemBarConfig({
            screenName,
            isDarkTheme,
          }).statusBarBackgroundColor,
        ).toBe('transparent');
      }
    }
  });

  it('matches the custom network screen header background', () => {
    for (const isDarkTheme of [false, true]) {
      const theme = isDarkTheme ? ThemeColors.dark : ThemeColors.light;
      expect(
        getScreenSystemBarConfig({
          screenName: RootNames.CustomTestnet,
          isDarkTheme,
        }),
      ).toEqual({
        statusBarStyle: isDarkTheme ? 'light-content' : 'dark-content',
        statusBarBackgroundColor: theme['neutral-card-2'],
      });
    }
  });

  it('preserves route-specific backgrounds', () => {
    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.ImportWatchAddress,
        isDarkTheme: false,
      }),
    ).toEqual({
      statusBarStyle: 'light-content',
      statusBarBackgroundColor: ThemeColors.light['blue-default'],
    });
  });
});
