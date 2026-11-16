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

import SetPassword2024 from './SetPassword2024';

// Screen contract for the first-password step of the import flow: the real
// form state, validation schema, consent card, notice and English copy run for
// real. Navigation, biometrics, the lock API, the preference write and leaf
// visual components are controlled boundaries.
const mockSetTrackingOptOut = jest.fn();
const mockResetPasswordOnUI = jest.fn();
const mockViewTermsOfUse = jest.fn();
const mockViewPrivacyPolicy = jest.fn();

// The constant barrel reads native modules at import time. The dev password
// prefills both fields, so the form is valid without typing.
jest.mock('@/constant', () => ({
  APP_FEATURE_SWITCH: { customizePassword: true },
  APP_TEST_PWD: 'correct-horse-battery',
}));
jest.mock('@/assets2024/icons/common/check.svg', () => () => null);
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useRoute: () => ({
    params: {
      title: 'Set Password',
      hideProgress: true,
      finishGoToScreen: 'ImportSuccess2024',
      isFirstImportPassword: true,
      hideBackIcon: true,
    },
  }),
}));
jest.mock('@/components/ScreenContainer/NormalScreenContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/AppStatusBar', () => ({
  useSafeSetNavigationOptions: () => ({ setNavigationOptions: jest.fn() }),
}));
jest.mock('@/components2024/ScreenHeader/HeaderTitleText', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components2024/progressBar', () => ({
  ProgressBar: () => null,
}));
jest.mock('@/components/Form/hooks', () => ({
  useInputBlurOnTouchaway: () => ({ onTouchInputAway: jest.fn() }),
}));
jest.mock('@/components2024/Toast', () => ({
  toast: {
    show: jest.fn(),
    success: jest.fn(),
    positions: { CENTER: 0 },
  },
  toastWithIcon: () => () => jest.fn(),
}));
jest.mock('@/hooks/biometrics', () => ({
  useBiometrics: () => ({
    computed: { defaultTypeLabel: 'Face ID', couldSetupBiometrics: false },
    fetchBiometrics: jest.fn(),
    toggleBiometrics: jest.fn(),
  }),
}));
jest.mock('@/hooks/address/useNewUser', () => ({
  useCreateAddressProc: () => ({ storePassword: jest.fn() }),
  useImportAddressProc: () => ({
    confirmCB: jest.fn(),
    resetImportAddressProc: jest.fn(),
  }),
}));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({ replace: jest.fn() }),
}));
jest.mock('@/core/apis', () => ({
  apisLock: {
    resetPasswordOnUI: (...args: unknown[]) => mockResetPasswordOnUI(...args),
  },
}));
jest.mock('@/core/serviceApi/preference', () => ({
  setUserBehaviorTrackingOptOutSync: (...args: unknown[]) =>
    mockSetTrackingOptOut(...args),
}));
jest.mock(
  '@/screens/ManagePassword/components/UserAgreementLikeModalInner2024',
  () => ({
    useShowUserAgreementLikeModal: () => ({
      viewTermsOfUse: mockViewTermsOfUse,
      viewPrivacyPolicy: mockViewPrivacyPolicy,
    }),
  }),
);
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }), colors2024 };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
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
jest.mock('@/components2024/Form/Input', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    NextInput: {
      Password: ReactModule.forwardRef(
        ({ inputProps }: { inputProps: object }, ref: unknown) =>
          ReactModule.createElement(TextInput, { ...inputProps, ref }),
      ),
    },
  };
});
jest.mock('@/components2024/Button', () => ({
  Button: ({
    title,
    containerStyle: _containerStyle,
    type: _type,
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
jest.mock('@/components/customized/Switch2024', () => ({
  AppSwitch2024: (props: Record<string, unknown>) =>
    require('react').createElement(require('react-native').View, props),
}));

const { onboarding } = E2E_ID;

function getDataAnalysisSwitch() {
  return screen.getByTestId(onboarding.setPasswordDataAnalysis);
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
  // Stop after the preference write: a failed password reset ends the submit.
  mockResetPasswordOnUI.mockResolvedValue({ error: 'stop here' });
});

describe('SetPassword2024 data analysis consent', () => {
  it('offers the toggle, on by default, and the consent notice', () => {
    render(<SetPassword2024 />);

    expect(screen.getByText('Help improve Rabby')).toBeTruthy();
    expect(getDataAnalysisSwitch().props.value).toBe(true);
    expect(screen.getByText(/By continuing, you agree to the/)).toBeTruthy();
  });

  it('opts the user in when the toggle is left on', async () => {
    render(<SetPassword2024 />);

    fireEvent.press(screen.getByTestId(onboarding.setPasswordSubmit));

    await waitFor(() => expect(mockResetPasswordOnUI).toHaveBeenCalledTimes(1));
    expect(mockSetTrackingOptOut).toHaveBeenCalledTimes(1);
    expect(mockSetTrackingOptOut).toHaveBeenCalledWith(false);
  });

  it('keeps the user opted out when the toggle is turned off', async () => {
    render(<SetPassword2024 />);

    await act(async () => {
      getDataAnalysisSwitch().props.onValueChange(false);
    });
    expect(getDataAnalysisSwitch().props.accessibilityLabel).toBe(
      onboarding.setPasswordDataAnalysisOff,
    );
    fireEvent.press(screen.getByTestId(onboarding.setPasswordSubmit));

    await waitFor(() => expect(mockResetPasswordOnUI).toHaveBeenCalledTimes(1));
    expect(mockSetTrackingOptOut).toHaveBeenCalledTimes(1);
    expect(mockSetTrackingOptOut).toHaveBeenCalledWith(true);
  });

  it('opens the agreements from the consent notice', () => {
    render(<SetPassword2024 />);

    fireEvent.press(screen.getByText('Terms of Use'));
    expect(mockViewTermsOfUse).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(mockViewPrivacyPolicy).toHaveBeenCalledTimes(1);
  });
});
