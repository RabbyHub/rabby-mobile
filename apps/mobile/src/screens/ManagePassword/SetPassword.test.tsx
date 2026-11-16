import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enLocale from '@/assets/locales/en/messages.json';
import { E2E_ID } from '@/constant/e2e';

import SetPasswordScreen from './SetPassword';

// Screen contract for the set-password page reached from Settings: the real
// form state, validation schema and consent card run for real. Navigation, the
// lock API, the stored preference and its write, the confirm dialog and leaf
// visual components are controlled boundaries.
const mockSetTrackingOptOut = jest.fn();
const mockSetupWalletPassword = jest.fn();
let mockStoredOptOut = true;

// The constant barrel reads native modules at import time. The dev password
// prefills both fields, so the form is valid without typing.
jest.mock('@/constant', () => ({
  APP_FEATURE_SWITCH: { customizePassword: true },
  APP_TEST_PWD: 'correct-horse-battery',
}));
jest.mock('./icons/password-lock-cc.svg', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: {
      actionAfterSetup: 'testkits:fromSettings',
      actionType: 'setAutoLockExpireTime',
    },
  }),
}));
jest.mock('@/components', () => ({
  Button: ({
    title,
    type: _type,
    containerStyle: _containerStyle,
    ...props
  }: Record<string, unknown>) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return ReactModule.createElement(
      Pressable,
      props,
      ReactModule.createElement(Text, null, title),
    );
  },
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeAndroidBottomSizes: (sizes: object) => ({ safeSizes: sizes }),
}));
jest.mock('@/components/Form/Input', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    FormInput: ReactModule.forwardRef(
      ({ inputProps }: { inputProps: object }, ref: unknown) =>
        ReactModule.createElement(TextInput, { ...inputProps, ref }),
    ),
  };
});
jest.mock('@/components/Icons/Checkbox', () => ({
  CheckBoxCircled: () => null,
}));
jest.mock('@/components2024/Toast', () => ({
  toast: {
    show: jest.fn(),
    success: jest.fn(),
    positions: { CENTER: 0 },
  },
  toastWithIcon: () => () => jest.fn(),
}));
jest.mock('@/core/apis', () => ({
  apisLock: {
    setupWalletPassword: (...args: unknown[]) =>
      mockSetupWalletPassword(...args),
  },
}));
jest.mock('@/components/Touchable/TouchableView', () => {
  const ReactModule = require('react');
  const { Pressable, View } = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => ReactModule.createElement(Pressable, props),
    SilentTouchableView: ({
      children,
      viewStyle,
    }: {
      children: unknown;
      viewStyle: unknown;
    }) => ReactModule.createElement(View, { style: viewStyle }, children),
  };
});
jest.mock('@/components/Touchable/TouchableText', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) =>
    require('react').createElement(
      require('react-native').Text,
      null,
      children,
    ),
}));
jest.mock('@/components/Form/hooks', () => ({
  useInputBlurOnTouchaway: () => ({ onTouchInputAway: jest.fn() }),
}));
jest.mock('@/hooks/navigation', () => ({
  requestLockWalletAndBackToUnlockScreen: jest.fn(),
  resetNavigationTo: jest.fn(),
  useRabbyAppNavigation: () => ({
    replace: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => false,
  }),
}));
jest.mock('@/hooks/useLock', () => ({
  sheetModalRefsNeedLock: {},
  useLoadLockInfo: () => ({ fetchLockInfo: jest.fn() }),
}));
jest.mock('./components/UserAgreementLikeModalInner', () => ({
  useShowUserAgreementLikeModal: () => ({
    viewTermsOfUse: jest.fn(),
    viewPrivacyPolicy: jest.fn(),
  }),
}));
jest.mock(
  '@/screens/ManagePassword/components/UserAgreementLikeModalInner2024',
  () => ({
    useShowUserAgreementLikeModal: () => ({
      viewTermsOfUse: jest.fn(),
      viewPrivacyPolicy: jest.fn(),
    }),
  }),
);
// The confirm dialog becomes a single button that confirms.
jest.mock('./components/ConfirmModal', () => ({
  ConfirmSetPasswordModal: ({
    visible,
    onConfirm,
  }: {
    visible: boolean;
    onConfirm: () => void;
  }) =>
    visible
      ? require('react').createElement(require('react-native').Pressable, {
          testID: 'confirm-set-password',
          onPress: onConfirm,
        })
      : null,
}));
jest.mock('@/core/serviceApi/preference', () => ({
  setUserBehaviorTrackingOptOutSync: (...args: unknown[]) =>
    mockSetTrackingOptOut(...args),
}));
jest.mock('@/utils/trackingOptOut', () => ({
  getUserBehaviorTrackingOptOut: () => mockStoredOptOut,
}));
jest.mock('@/hooks/theme', () => {
  const makeColors = () =>
    new Proxy({}, { get: (_target, key) => String(key) });
  return {
    useThemeStyles: (getStyles: (colors: object) => object) => {
      const colors = makeColors();
      return { styles: getStyles(colors), colors };
    },
    useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
      const colors2024 = makeColors();
      return { styles: getStyle({ colors2024 }), colors2024 };
    },
  };
});
jest.mock('@/utils/styles', () => ({
  createGetStyles: (getStyles: unknown) => getStyles,
  createGetStyles2024: (getStyle: unknown) => getStyle,
  makeDebugBorder: () => ({}),
}));
jest.mock('@/utils/makeTestIDProps', () => ({
  makeTestIDProps: (testID: string, accessibilityLabel?: string) => ({
    testID,
    accessibilityLabel: accessibilityLabel ?? testID,
  }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/customized/Switch2024', () => ({
  AppSwitch2024: (props: Record<string, unknown>) =>
    require('react').createElement(require('react-native').View, props),
}));

const { onboarding } = E2E_ID;

function getDataAnalysisSwitch() {
  return screen.getByTestId(onboarding.setPasswordDataAnalysis);
}

async function submitAndConfirm() {
  fireEvent.press(screen.getByText('Next'));
  fireEvent.press(await screen.findByTestId('confirm-set-password'));
  await waitFor(() => expect(mockSetupWalletPassword).toHaveBeenCalledTimes(1));
}

beforeAll(async () => {
  await i18next.use(initReactI18next).init({
    lng: 'en-US',
    fallbackLng: 'en-US',
    defaultNS: 'translations',
    resources: { 'en-US': { translations: enLocale } },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredOptOut = true;
  // Stop after the preference write: a failed password setup ends the submit.
  mockSetupWalletPassword.mockResolvedValue({ error: 'stop here' });
});

describe('ManagePassword SetPassword data analysis toggle', () => {
  it('starts off when the Settings switch is off', () => {
    mockStoredOptOut = true;
    render(<SetPasswordScreen />);

    expect(screen.getByText('Help improve Rabby')).toBeTruthy();
    expect(getDataAnalysisSwitch().props.value).toBe(false);
  });

  it('starts on when the Settings switch is on', () => {
    mockStoredOptOut = false;
    render(<SetPasswordScreen />);

    expect(getDataAnalysisSwitch().props.value).toBe(true);
  });

  it('leaves an opted-out user opted out when the toggle is untouched', async () => {
    mockStoredOptOut = true;
    render(<SetPasswordScreen />);

    await submitAndConfirm();

    expect(mockSetTrackingOptOut).toHaveBeenCalledTimes(1);
    expect(mockSetTrackingOptOut).toHaveBeenCalledWith(true);
  });

  it('leaves an opted-in user opted in when the toggle is untouched', async () => {
    mockStoredOptOut = false;
    render(<SetPasswordScreen />);

    await submitAndConfirm();

    expect(mockSetTrackingOptOut).toHaveBeenCalledTimes(1);
    expect(mockSetTrackingOptOut).toHaveBeenCalledWith(false);
  });

  it('saves the new choice when the user turns the toggle on', async () => {
    mockStoredOptOut = true;
    render(<SetPasswordScreen />);

    await act(async () => {
      getDataAnalysisSwitch().props.onValueChange(true);
    });
    await submitAndConfirm();

    expect(mockSetTrackingOptOut).toHaveBeenCalledTimes(1);
    expect(mockSetTrackingOptOut).toHaveBeenCalledWith(false);
  });
});
