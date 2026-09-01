import { RootNames, getScreenSystemBarConfig } from './layout';
import { ThemeColors, ThemeColors2024 } from './theme';

describe('screen system bar configuration', () => {
  it('uses the 2024 background for the home screen', () => {
    expect(
      getScreenSystemBarConfig({
        screenName: RootNames.Home,
        isDarkTheme: false,
      }),
    ).toEqual({
      statusBarStyle: 'dark-content',
      statusBarBackgroundColor: ThemeColors2024.light['neutral-bg-1'],
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
