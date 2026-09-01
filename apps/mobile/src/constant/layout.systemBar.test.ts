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
