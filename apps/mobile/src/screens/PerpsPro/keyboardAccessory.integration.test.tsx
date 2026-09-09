import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React, { useRef, useState } from 'react';
import { Text, TextInput } from '@/components/Typography';
import { PerpsProDecimalTextInput } from './components/trade/PerpsProDecimalTextInput';
import { perpsProKeyboardSession } from './components/common/perpsProKeyboardSession';
import { usePerpsProKeyboardInput } from './components/common/usePerpsProKeyboardInput';

const SheetInput = ({ visible }: { visible: boolean }) => {
  const ref = useRef<TextInput>(null);
  const keyboard = usePerpsProKeyboardInput(ref, { enabled: visible });
  return <TextInput ref={ref} {...keyboard} testID="sheet-input" />;
};

const Inputs = ({
  minimum = '15.35 USDC',
  showAmount = true,
}: {
  minimum?: string | null;
  showAmount?: boolean;
}) => {
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  return (
    <>
      {showAmount ? (
        <PerpsProDecimalTextInput
          testID="amount"
          keyboardMinimum={minimum}
          maxDecimals={2}
          onChangeText={setAmount}
          value={amount}
        />
      ) : null}
      <PerpsProDecimalTextInput
        testID="price"
        maxDecimals={2}
        onChangeText={setPrice}
        value={price}
      />
      <Text testID="draft">{amount}</Text>
    </>
  );
};

describe('Pro native-input registration and decimal editing', () => {
  beforeEach(() => perpsProKeyboardSession.setEnabled(true));
  afterEach(() => act(() => perpsProKeyboardSession.setEnabled(false)));

  it('keeps editing owned by the decimal input while switching hints between inputs', () => {
    render(<Inputs />);
    const amount = screen.getByTestId('amount');
    fireEvent(amount, 'focus');
    expect(perpsProKeyboardSession.getSnapshot()?.minimum).toBe('15.35 USDC');
    fireEvent.changeText(amount, '12.34');
    expect(screen.getByTestId('draft').props.children).toBe('12.34');
    fireEvent(screen.getByTestId('price'), 'focus');
    fireEvent(amount, 'blur');
    expect(perpsProKeyboardSession.getSnapshot()?.minimum).toBeNull();
    expect(screen.getByTestId('amount').props.value).toBe('12.34');
    fireEvent(screen.getByTestId('price'), 'blur');
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
  });

  it('updates the focused hint without remounting or changing the native draft', () => {
    const view = render(<Inputs />);
    fireEvent(screen.getByTestId('amount'), 'focus');
    const id = perpsProKeyboardSession.getSnapshot()?.id;
    fireEvent.changeText(screen.getByTestId('amount'), '0.');
    view.rerender(<Inputs minimum="0.002 SP500" />);
    expect(perpsProKeyboardSession.getSnapshot()).toMatchObject({
      id,
      minimum: '0.002 SP500',
    });
    expect(screen.getByTestId('amount').props.value).toBe('0.');
    view.rerender(<Inputs minimum={null} />);
    expect(perpsProKeyboardSession.getSnapshot()?.minimum).toBeNull();
    view.rerender(<Inputs showAmount={false} />);
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
  });

  it('clears ownership on leaving Pro and rejects an inactive input focus', () => {
    render(<Inputs />);
    fireEvent(screen.getByTestId('amount'), 'focus');
    act(() => perpsProKeyboardSession.setEnabled(false));
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    fireEvent(screen.getByTestId('price'), 'focus');
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
  });

  it('clears a dismissed sheet owner even when its input has not unmounted or delivered blur', () => {
    const view = render(<SheetInput visible />);
    fireEvent(screen.getByTestId('sheet-input'), 'focus');
    expect(perpsProKeyboardSession.getSnapshot()).not.toBeNull();
    view.rerender(<SheetInput visible={false} />);
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    fireEvent(screen.getByTestId('sheet-input'), 'focus');
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    view.rerender(<SheetInput visible />);
    fireEvent(screen.getByTestId('sheet-input'), 'focus');
    expect(perpsProKeyboardSession.getSnapshot()?.minimum).toBeNull();
  });
});
