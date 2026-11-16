import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { View } from 'react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import enLocale from '@/assets/locales/en/messages.json';
import { E2E_ID } from '@/constant/e2e';

import { PasswordForm } from './PasswordForm';

// Component contract: the real form state, validation schema, English copy and
// Trans link wiring run for real. Biometric capability, the agreement sheets,
// theme and leaf visual components are controlled boundaries.
let mockCouldSetupBiometrics = false;
const mockViewTermsOfUse = jest.fn();
const mockViewPrivacyPolicy = jest.fn();

// The constant barrel reads native modules at import time.
jest.mock('@/constant', () => ({ APP_TEST_PWD: '' }));
jest.mock('@/assets2024/icons/common/check.svg', () => () => null);
jest.mock('@/assets2024/icons/common/fack_id.svg', () => () => null);
jest.mock('@/assets2024/icons/common/fingerprint.svg', () => () => null);
jest.mock('@/hooks/biometrics', () => ({
  useBiometrics: () => ({
    computed: {
      defaultTypeLabel: 'Face ID',
      couldSetupBiometrics: mockCouldSetupBiometrics,
      isFaceID: true,
    },
  }),
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
jest.mock('@/components2024/Form/Input', () => ({
  NextInput: {
    Password: ({ inputProps }: { inputProps: object }) =>
      require('react').createElement(
        require('react-native').TextInput,
        inputProps,
      ),
  },
}));
jest.mock('@/components2024/Button', () => ({
  Button: ({
    title,
    icon: _icon,
    containerStyle: _containerStyle,
    loading: _loading,
    type: _type,
    height: _height,
    titleStyle: _titleStyle,
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

const PASSWORD = 'correct-horse-battery';
const { onboarding } = E2E_ID;

function toggleDataAnalysis(value: boolean) {
  act(() => {
    screen
      .getByTestId(onboarding.setPasswordDataAnalysis)
      .props.onValueChange(value);
  });
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
  mockCouldSetupBiometrics = false;
});

describe('PasswordForm data analysis toggle', () => {
  it('explains the toggle and defaults it to on', () => {
    render(<PasswordForm onSubmit={jest.fn()} />);

    expect(screen.getByText('Help improve Rabby')).toBeTruthy();
    expect(
      screen.getByText(
        'Share anonymous usage data to help improve Rabby. Collected data is not associated with you or your account. You can change this anytime in Settings.',
      ),
    ).toBeTruthy();
    const dataAnalysisSwitch = screen.getByTestId(
      onboarding.setPasswordDataAnalysis,
    );
    expect(dataAnalysisSwitch.props.value).toBe(true);
    expect(dataAnalysisSwitch.props.accessibilityLabel).toBe(
      onboarding.setPasswordDataAnalysisOn,
    );
  });

  it('submits the accepted choice with a user password', async () => {
    const onSubmit = jest.fn();
    render(
      <PasswordForm
        onSubmit={onSubmit}
        initialValues={{ password: PASSWORD, confirmPassword: PASSWORD }}
      />,
    );

    fireEvent.press(screen.getByTestId(onboarding.setPasswordSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      password: PASSWORD,
      confirmPassword: PASSWORD,
      enableBiometrics: false,
      enableDataAnalysis: true,
    });
  });

  it('submits the declined choice with a user password', async () => {
    const onSubmit = jest.fn();
    render(
      <PasswordForm
        onSubmit={onSubmit}
        initialValues={{ password: PASSWORD, confirmPassword: PASSWORD }}
      />,
    );

    toggleDataAnalysis(false);
    expect(
      screen.getByTestId(onboarding.setPasswordDataAnalysis).props
        .accessibilityLabel,
    ).toBe(onboarding.setPasswordDataAnalysisOff);
    fireEvent.press(screen.getByTestId(onboarding.setPasswordSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      password: PASSWORD,
      enableDataAnalysis: false,
    });
  });

  it('toggles from the title row, not only from the compact switch', async () => {
    render(<PasswordForm onSubmit={jest.fn()} />);
    const getSwitchValue = () =>
      screen.getByTestId(onboarding.setPasswordDataAnalysis).props.value;
    // The async act also lets the form's follow-up validation settle.
    const pressTitle = () =>
      act(async () => {
        fireEvent.press(screen.getByText('Help improve Rabby'));
      });

    await pressTitle();
    expect(getSwitchValue()).toBe(false);

    await pressTitle();
    expect(getSwitchValue()).toBe(true);
  });

  it('carries the declined choice through the biometric shortcut', async () => {
    mockCouldSetupBiometrics = true;
    const onSubmit = jest.fn();
    render(<PasswordForm onSubmit={onSubmit} />);

    // Biometric mode hides the password fields but keeps the toggle.
    expect(screen.queryByTestId(onboarding.setPasswordInput)).toBeNull();
    toggleDataAnalysis(false);
    fireEvent.press(screen.getByTestId(onboarding.setPasswordSubmit));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      password: '',
      confirmPassword: '',
      enableBiometrics: true,
      enableDataAnalysis: false,
      useAutoGeneratedPassword: true,
    });
  });

  it('opens the agreements from the consent notice', () => {
    render(<PasswordForm onSubmit={jest.fn()} />);

    fireEvent.press(screen.getByText('Terms of Use'));
    expect(mockViewTermsOfUse).toHaveBeenCalledTimes(1);
    expect(mockViewPrivacyPolicy).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Privacy Policy'));
    expect(mockViewPrivacyPolicy).toHaveBeenCalledTimes(1);
  });

  it('hands the fields and the footer to the screen as separate parts', () => {
    // SetupWallet scrolls the fields under a footer that stays fixed.
    render(
      <PasswordForm onSubmit={jest.fn()}>
        {({ content, footer }) => (
          <>
            <View testID="scroll-area">{content}</View>
            <View testID="fixed-footer">{footer}</View>
          </>
        )}
      </PasswordForm>,
    );

    const scrollArea = within(screen.getByTestId('scroll-area'));
    const fixedFooter = within(screen.getByTestId('fixed-footer'));

    expect(
      scrollArea.getByTestId(onboarding.setPasswordDataAnalysis),
    ).toBeTruthy();
    expect(scrollArea.queryByTestId(onboarding.setPasswordSubmit)).toBeNull();
    expect(scrollArea.queryByText('Privacy Policy')).toBeNull();

    expect(fixedFooter.getByTestId(onboarding.setPasswordSubmit)).toBeTruthy();
    expect(fixedFooter.getByText('Terms of Use')).toBeTruthy();
    expect(fixedFooter.getByText('Privacy Policy')).toBeTruthy();
  });
});
