import { RootNames, getScreenSystemBarConfig } from './layout';
import { ThemeColors } from './theme';

const transparentScreenNames = [
  RootNames.Home,
  RootNames.Points,
  RootNames.Lending,
  RootNames.Settings,
  RootNames.WalletConnect,
  RootNames.BatchRevoke,
  RootNames.GasAccount,
  RootNames.Perps,
  RootNames.Scanner,
  RootNames.SingleAddressHome,
  RootNames.TokenDetail,
  RootNames.TokenMarketInfo,
] as const;

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

  it('matches the effective theme on every transparent screen', () => {
    for (const [isDarkTheme, statusBarStyle] of [
      [false, 'dark-content'],
      [true, 'light-content'],
    ] as const) {
      for (const screenName of transparentScreenNames) {
        expect(
          getScreenSystemBarConfig({
            screenName,
            isDarkTheme,
          }),
        ).toEqual({
          statusBarStyle,
          statusBarBackgroundColor: 'transparent',
        });
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
