import React, { useState } from 'react';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import {
  AppState,
  InputAccessoryView,
  Keyboard,
  Platform,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Portal, PortalProvider } from '@gorhom/portal';
import { TextInput } from '@/components/Typography';
import { PerpsProDecimalTextInput } from './components/trade/PerpsProDecimalTextInput';
import { PerpsProMarketSearchBar } from './components/market/PerpsProMarketSearchBar';
import { PerpsProKeyboardAccessory } from './components/common/PerpsProKeyboardAccessory';
import {
  PERPS_PRO_KEYBOARD_ACCESSORY_ID,
  perpsProKeyboardSession,
} from './components/common/perpsProKeyboardSession';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@gorhom/bottom-sheet', () => ({
  ...require('@gorhom/bottom-sheet/mock'),
  useBottomSheetModalInternal: () => ({ hostName: 'root' }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

const runtime = globalThis as typeof globalThis & {
  nativeFabricUIManager?: unknown;
};
const initialFabric = runtime.nativeFabricUIManager;
const initialPlatform = Platform.OS;
const initialAppState = AppState.currentState;
const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    <PortalProvider>{children}</PortalProvider>
  </SafeAreaProvider>
);

const Field = ({
  name,
  minimum = null,
  inputRef,
}: {
  name: string;
  minimum?: string | null;
  inputRef?: React.RefObject<TextInput | null>;
}) => {
  const [value, setValue] = useState('');
  return (
    <PerpsProDecimalTextInput
      ref={inputRef}
      testID={name}
      keyboardMinimum={minimum}
      maxDecimals={2}
      onChangeText={setValue}
      value={value}
      renderInput={input => <View testID={`${name}-editor`}>{input}</View>}
    />
  );
};

const Inputs = ({
  sheet = false,
  minimum = '15 USDC',
  priceRef,
}: {
  sheet?: boolean;
  minimum?: string | null;
  priceRef?: React.RefObject<TextInput | null>;
}) => (
  <>
    <PerpsProKeyboardAccessory />
    <Field name="amount" minimum={minimum} />
    <Field name="price" inputRef={priceRef} />
    {sheet ? (
      <Portal name="late-sheet">
        <View testID="sheet">
          <Field name="sheet-price" />
          <PerpsProMarketSearchBar
            placeholder="Search"
            value=""
            onChangeText={() => undefined}
            onFocusChange={() => undefined}
          />
        </View>
      </Portal>
    ) : null}
  </>
);

const hostFor = (testID: string) => {
  const input = screen.getByTestId(testID);
  const host = screen
    .UNSAFE_getAllByType(InputAccessoryView)
    .find(node => node.props.nativeID === input.props.inputAccessoryViewID);
  expect(host).toBeDefined();
  return host!;
};

// JS integration proves the real composition/session contract. Setting the
// renderer flag does not execute UIKit: device validation is documented in README.
describe('Pro iOS accessory binding across renderers', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    runtime.nativeFabricUIManager = {};
    AppState.currentState = 'active';
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  });
  afterEach(() => {
    cleanup();
    perpsProKeyboardSession.setEnabled(false);
    runtime.nativeFabricUIManager = initialFabric;
    Platform.OS = initialPlatform;
    AppState.currentState = initialAppState;
    jest.restoreAllMocks();
  });

  it.each([
    ['ios', false, 1],
    ['ios', true, 4],
    ['android', false, 0],
    ['android', true, 0],
  ] as const)(
    'uses the expected hosts on %s with Fabric=%s',
    (platform, fabric, count) => {
      Platform.OS = platform;
      runtime.nativeFabricUIManager = fabric ? {} : undefined;
      render(<Inputs sheet />, { wrapper });
      expect(screen.UNSAFE_queryAllByType(InputAccessoryView)).toHaveLength(
        count,
      );
      const ids = ['amount', 'price', 'sheet-price', 'market-search'].map(
        id => screen.getByTestId(id).props.inputAccessoryViewID,
      );
      if (platform === 'android') {
        expect(ids).toEqual([undefined, undefined, undefined, undefined]);
      } else if (fabric) {
        expect(new Set(ids).size).toBe(4);
        for (const id of ['amount', 'price', 'sheet-price', 'market-search'])
          hostFor(id);
      } else {
        expect(ids).toEqual(Array(4).fill(PERPS_PRO_KEYBOARD_ACCESSORY_ID));
      }
    },
  );

  it('keeps each native input/host stable through editing, focus hand-off, hints and Done', () => {
    const priceRef = React.createRef<TextInput>();
    const view = render(<Inputs priceRef={priceRef} />, { wrapper });
    const amount = screen.getByTestId('amount');
    const price = screen.getByTestId('price');
    const amountHost = hostFor('amount');
    const priceHost = hostFor('price');
    const amountId = amount.props.inputAccessoryViewID;
    const priceId = price.props.inputAccessoryViewID;
    fireEvent(amount, 'focus');
    fireEvent.changeText(amount, '0.');
    expect(
      within(amountHost).getByTestId('perps-pro-keyboard-minimum'),
    ).toBeTruthy();
    expect(
      within(priceHost).queryByTestId('perps-pro-keyboard-minimum'),
    ).toBeNull();
    view.rerender(<Inputs priceRef={priceRef} minimum="0.002 BTC" />);
    expect(screen.getByTestId('amount')).toBe(amount);
    expect(amount.props.value).toBe('0.');
    fireEvent(price, 'focus');
    fireEvent(amount, 'blur'); // A late blur must not clear the new owner.
    const priceOwner = perpsProKeyboardSession.getSnapshot();
    expect(priceOwner?.input).toBe(priceRef.current);
    expect(
      within(amountHost).queryByTestId('perps-pro-keyboard-minimum'),
    ).toBeNull();
    expect(hostFor('amount')).toBe(amountHost);
    expect(hostFor('price')).toBe(priceHost);
    expect(amount.props.inputAccessoryViewID).toBe(amountId);
    expect(price.props.inputAccessoryViewID).toBe(priceId);
    const blur = jest.spyOn(priceRef.current!, 'blur');
    fireEvent.press(within(priceHost).getByTestId('perps-pro-keyboard-done'));
    expect(blur).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    expect(hostFor('price')).toBe(priceHost);
    expect(amount.props.value).toBe('0.');
    act(() => perpsProKeyboardSession.setEnabled(false));
    expect(hostFor('amount')).toBe(amountHost);
  });

  it('mounts late Portal inputs with their own hosts and removes those hosts on close', () => {
    const view = render(<Inputs />, { wrapper });
    const amountHost = hostFor('amount');
    view.rerender(<Inputs sheet />);
    const sheetHost = hostFor('sheet-price');
    const searchHost = hostFor('market-search');
    const oldId = sheetHost.props.nativeID;
    expect(
      within(screen.getByTestId('sheet')).UNSAFE_getAllByType(
        InputAccessoryView,
      ),
    ).toEqual([sheetHost, searchHost]);
    // The local editor remains before the accessory, including renderInput wrappers.
    const order: string[] = [];
    const visit = (
      node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null,
    ) => {
      if (!node || typeof node === 'string') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (node.props.testID === 'sheet-price-editor') order.push('editor');
      if (node.props.nativeID === oldId) order.push('accessory');
      node.children?.forEach(visit);
    };
    visit(view.toJSON());
    expect(order).toEqual(['editor', 'accessory']);
    fireEvent(screen.getByTestId('sheet-price'), 'focus');
    view.rerender(<Inputs />);
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    expect(screen.UNSAFE_getAllByType(InputAccessoryView)).toHaveLength(2);
    expect(hostFor('amount')).toBe(amountHost);
    view.rerender(<Inputs sheet />);
    expect(hostFor('sheet-price').props.nativeID).not.toBe(oldId);
    hostFor('market-search');
  });
});
