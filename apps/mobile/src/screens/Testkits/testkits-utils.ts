import { RootNames } from '@/constant/layout';
import { navigate, naviPush, replace } from '@/utils/navigation';

export const devOnlyDelayNavi = (
  customizeNaviPush: (ctx: {
    RootNames: typeof RootNames;
    navigate: typeof navigate;
    naviPush: typeof naviPush;
    naviReplace: typeof replace;
  }) => void,
  options?: {
    timeout?: number;
  },
) => {
  if (!__DEV__) return;

  const { timeout = 5 * 1e3 } = options ?? {};
  setTimeout(() => {
    customizeNaviPush({
      RootNames,
      navigate,
      naviPush,
      naviReplace: replace,
    });
  }, timeout);
};
