import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, TextInput as NativeTextInput } from 'react-native';
import { ThemeColors2024 } from '@/constant/theme';
import { PERPS_PRO_INPUT_COLOR_PROPS } from '../../PerpsPro/components/common/perpsProInputVisual';

let mockIsLight = true;

// Unit/component contract: render the actual funding components and their
// input props. Funding data/actions and unrelated child UI are outside this test.
jest.mock('@/components', () => ({ AssetAvatar: () => null }));
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/Chain/ChainIconImage', () => () => null);
jest.mock('@/components/Tip', () => ({ Tip: () => null }));
jest.mock('@/components2024/Button', () => ({ Button: () => null }));
jest.mock('@/components2024/AuthButton', () => () => null);
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: object, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: jest.fn(),
          close: jest.fn(),
          dismiss: jest.fn(),
        }));
        return ReactModule.createElement(require('react-native').View, props);
      },
    ),
  };
});
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
  BottomSheetTextInput: require('react-native').TextInput,
}));
jest.mock('@rneui/themed', () => ({ Skeleton: () => null }));
jest.mock('@debank/common', () => ({ CHAINS_ENUM: { ETH: 'ETH' } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (ctx: object) => object }) => {
    const colors2024 =
      require('@/constant/theme').ThemeColors2024[
        mockIsLight ? 'light' : 'dark'
      ];
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({
        colors2024,
        isLight: mockIsLight,
        safeAreaInsets: { bottom: 0 },
      }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (factory: unknown) => factory,
}));
jest.mock('@/utils/number', () => ({
  formatPerpsUsdValue: String,
  formatUsdValue: String,
}));
jest.mock('@/core/native/utils', () => ({ IS_ANDROID: false }));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/constant/swap', () => ({ ETH_USDT_CONTRACT: '' }));
jest.mock('@/core/apis', () => ({ apisPerps: {} }));
jest.mock('@/core/apis/sendRequest', () => ({ abiCoder: {} }));
jest.mock('@/core/apis/provider', () => ({ getERC20Allowance: jest.fn() }));
jest.mock('@/core/apis/approvals', () => ({ approveToken: jest.fn() }));
jest.mock('@/utils/account', () => ({
  isAccountSupportDirectSign: () => false,
  isAccountSupportMiniApproval: () => false,
}));
jest.mock('@/utils/chain', () => ({
  findChain: () => null,
  findChainByServerID: () => null,
}));
jest.mock('@/utils/token', () => ({
  getTokenSymbol: (token: { symbol?: string }) => token?.symbol || 'USDC',
  tokenItemToITokenItem: (token: unknown) => token,
}));
jest.mock('@/screens/Transaction/components/SkeletonCard', () => ({
  Linear: () => null,
}));
jest.mock('@/screens/Swap/utils', () => ({ tokenAmountBn: jest.fn() }));
jest.mock('@/screens/Swap/hooks/twoStepSwap', () => ({
  useTwoStepSwap: () => ({ shouldTwoStep: false }),
}));
jest.mock('@/hooks/perps/usePerpsAccount', () => ({
  usePerpsAccount: () => ({
    availableBalance: 0,
    spotBalancesMap: {},
    getSpotBalance: () => 0,
  }),
}));
jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: (selector: (state: object) => unknown) =>
    selector({ marketDataMap: {}, currentPerpsAccount: null }),
}));
jest.mock('@/core/utils/reexports', () => ({
  zCreate: require('zustand').create,
  zMutative: (creator: unknown) => creator,
}));
jest.mock('@/store/tokens', () => ({
  __esModule: true,
  default: {},
  EMPTY_TOKEN_ENTITY_IDS: [],
  useTokenIndexStore: (selector: (state: object) => unknown) =>
    selector({ addressTokenIds: {} }),
  tokenEntityResourceStore: {
    useStore: (selector: (state: object) => unknown) =>
      selector({ metaMap: {} }),
  },
}));
jest.mock('ahooks', () => ({
  ...jest.requireActual('ahooks'),
  useRequest: () => ({ data: undefined, loading: false, runAsync: jest.fn() }),
}));
jest.mock('react-use/lib/useAsync', () => () => ({ value: [] }));
jest.mock('react-use/lib/useDebounce', () => () => []);
jest.mock('./PerpsDepositPopup/PerpsSelectTokenPopup', () => ({
  PerpsSelectTokenPopup: () => null,
}));
jest.mock('./PerpsDepositPopup/PerpsDepositTokenModal', () => ({
  PerpsDepositTokenModal: () => null,
}));
jest.mock('./PerpsWithdrawPopup/PerpsWithdrawSelectTokenPopup', () => ({
  PerpsWithdrawSelectTokenPopup: () => null,
}));
jest.mock('./PerpsWithdrawPopup/PerpsWithdrawSelectChainPopup', () => ({
  PerpsWithdrawSelectChainPopup: () => null,
}));
jest.mock('@/assets/icons/swap', () => ({ RcIconSwapBottomArrow: () => null }));
jest.mock('@/assets/icons/common', () => ({
  RcIconInfoFill1CC: () => null,
  RcIconInfoFillCC: () => null,
}));
jest.mock('@/assets/icons/common/arrow-down-cc.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconInfoCC.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconUSDC.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconUSDT.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconUSDH.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconUSDE.svg', () => () => null);
jest.mock('@/assets2024/icons/perps/IconSwapDeposit.svg', () => () => null);

import { PerpsDepositPopup } from './PerpsDepositPopup';
import { PerpsWithdrawPopup } from './PerpsWithdrawPopup';
import { PerpsSpotSwapPopup } from './PerpsSpotSwapPopup';

const testAccount = { address: '' } as React.ComponentProps<
  typeof PerpsDepositPopup
>['account'];

describe.each([
  ['Deposit', PerpsDepositPopup],
  ['Withdraw', PerpsWithdrawPopup],
  ['Swap', PerpsSpotSwapPopup],
] as const)('%s input colors', (_name, Popup) => {
  it.each([
    ['ios', 'light'],
    ['ios', 'dark'],
    ['android', 'light'],
    ['android', 'dark'],
  ] as const)(
    'preserves the %s/%s default and applies only explicit Pro colors',
    (platform, theme) => {
      const previousPlatform = Platform.OS;
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: platform,
      });
      mockIsLight = theme === 'light';
      try {
        const props = {
          account: testAccount,
          onClose: jest.fn(),
          visible: false,
        };
        const view = render(<Popup {...props} />);
        const originalProps = screen.UNSAFE_getByType(NativeTextInput).props;
        expect(originalProps.cursorColor).toBeUndefined();
        expect(originalProps.selectionColor).toBeUndefined();
        expect(originalProps.placeholderTextColor).toBe(
          ThemeColors2024[theme]['neutral-info'],
        );

        view.rerender(
          <Popup {...props} inputColorProps={PERPS_PRO_INPUT_COLOR_PROPS} />,
        );
        const coloredProps = screen.UNSAFE_getByType(NativeTextInput).props;
        expect(coloredProps).toMatchObject(PERPS_PRO_INPUT_COLOR_PROPS);
        for (const key of [
          'style',
          'value',
          'keyboardType',
          'numberOfLines',
          'textAlignVertical',
          'placeholder',
          'placeholderTextColor',
        ]) {
          expect(coloredProps[key]).toEqual(originalProps[key]);
        }

        view.rerender(<Popup {...props} />);
        expect(
          screen.UNSAFE_getByType(NativeTextInput).props.cursorColor,
        ).toBeUndefined();
        expect(
          screen.UNSAFE_getByType(NativeTextInput).props.selectionColor,
        ).toBeUndefined();
        view.unmount();
      } finally {
        Object.defineProperty(Platform, 'OS', {
          configurable: true,
          value: previousPlatform,
        });
      }
    },
  );
});
