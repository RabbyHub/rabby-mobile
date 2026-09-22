import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { UR, URDecoder, UREncoder } from '@ngraveio/bc-ur';
import Player from './Player';

const mockFooterRender = jest.fn();

jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => ({ 'neutral-title-1': '#000000' }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: () => null,
}));

jest.mock('react-native-qrcode-svg', () => {
  const { Text } = require('react-native');
  return ({ value }: { value: string }) => (
    <Text testID="qr-value">{value}</Text>
  );
});

jest.mock('@/components/FooterButton/FooterButton', () => {
  const { Pressable, Text } = require('react-native');
  return {
    FooterButton: ({
      onPress,
      title,
    }: {
      onPress: () => void;
      title: string;
    }) => {
      mockFooterRender();
      return (
        <Pressable testID="get-signature" onPress={onPress}>
          <Text>{title}</Text>
        </Pressable>
      );
    },
  };
});

// Component coverage: real UR codec and React lifecycle, mocked native QR/button
// rendering. Touch latency and hardware scanning require separate device checks.
const payload = UR.fromBuffer(
  Buffer.from(Array.from({ length: 650 }, (_, i) => i % 256)),
);
const props = {
  type: payload.type,
  cbor: payload.cbor.toString('hex'),
  onSign: jest.fn(),
};
const qrValue = (): string => screen.getByTestId('qr-value').props.children;
const advance = (milliseconds: number) => {
  act(() => jest.advanceTimersByTime(milliseconds));
};

describe('Keystone QR Player', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('shows consecutive fragments after each 100ms wait and reconstructs the payload', () => {
    render(<Player {...props} />);
    const decoder = new URDecoder();
    const [, [firstSequence]] = URDecoder.parse(qrValue());
    const [, fragmentCount] = URDecoder.parseSequenceComponent(firstSequence);

    for (let sequence = 1; sequence <= fragmentCount; sequence++) {
      const frame = qrValue();
      const [, [sequenceComponent]] = URDecoder.parse(frame);
      expect(URDecoder.parseSequenceComponent(sequenceComponent)).toEqual([
        sequence,
        fragmentCount,
      ]);
      decoder.receivePart(frame);
      if (sequence < fragmentCount) {
        advance(99);
        expect(qrValue()).toBe(frame);
        advance(1);
      }
    }

    expect(decoder.isSuccess()).toBe(true);
    expect(decoder.resultUR().equals(payload)).toBe(true);
  });

  it('does not accumulate encoded frames while the next React commit is pending', () => {
    const nextPart = jest.spyOn(UREncoder.prototype, 'nextPart');
    render(<Player {...props} />);

    // One act keeps React from committing between the elapsed timer ticks.
    advance(1000);
    expect(nextPart).toHaveBeenCalledTimes(2);
    expect(URDecoder.parse(qrValue())[1][0]).toMatch(/^2-/);

    advance(100);
    expect(nextPart).toHaveBeenCalledTimes(3);
    expect(URDecoder.parse(qrValue())[1][0]).toMatch(/^3-/);
  });

  it('does not advance the encoder when the parent rerenders', () => {
    const nextPart = jest.spyOn(UREncoder.prototype, 'nextPart');
    const view = render(<Player {...props} brandName="Keystone" />);
    const firstFrame = qrValue();

    view.rerender(<Player {...props} brandName="NGRAVE ZERO" />);
    expect(qrValue()).toBe(firstFrame);
    expect(nextPart).toHaveBeenCalledTimes(1);
    advance(100);
    expect(URDecoder.parse(qrValue())[1][0]).toMatch(/^2-/);
    expect(nextPart).toHaveBeenCalledTimes(2);
  });

  it('updates QR frames without rerendering the signature button', () => {
    render(<Player {...props} />);
    const initialFooterRenders = mockFooterRender.mock.calls.length;
    const firstFrame = qrValue();

    for (let i = 0; i < 5; i++) {
      advance(100);
    }

    expect(qrValue()).not.toBe(firstFrame);
    expect(mockFooterRender).toHaveBeenCalledTimes(initialFooterRenders);
    fireEvent.press(screen.getByTestId('get-signature'));
    expect(props.onSign).toHaveBeenCalledTimes(1);
  });

  it('encodes a single-fragment payload once without starting a timer', () => {
    const nextPart = jest.spyOn(UREncoder.prototype, 'nextPart');
    const singlePayload = UR.fromBuffer(Buffer.from('single frame'));
    render(<Player {...props} cbor={singlePayload.cbor.toString('hex')} />);
    const frame = qrValue();

    expect(URDecoder.decode(frame).equals(singlePayload)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    advance(1000);
    expect(qrValue()).toBe(frame);
    expect(nextPart).toHaveBeenCalledTimes(1);
  });

  it.each(['cbor', 'type'] as const)(
    'immediately resets changed %s and clears replaced/unmounted timers',
    changedField => {
      const nextPart = jest.spyOn(UREncoder.prototype, 'nextPart');
      const view = render(<Player {...props} />);
      advance(99);
      const replacement = new UR(
        changedField === 'cbor'
          ? UR.fromBuffer(Buffer.alloc(650, 42)).cbor
          : payload.cbor,
        changedField === 'type' ? 'eth-sign-request' : payload.type,
      );
      const expectedEncoder = new UREncoder(replacement, 200);
      const firstReplacementFrame = expectedEncoder.nextPart().toUpperCase();
      const secondReplacementFrame = expectedEncoder.nextPart().toUpperCase();

      view.rerender(
        <Player
          {...props}
          type={replacement.type}
          cbor={replacement.cbor.toString('hex')}
        />,
      );
      expect(qrValue()).toBe(firstReplacementFrame);
      expect(jest.getTimerCount()).toBe(1);
      const encodesAfterReplacement = nextPart.mock.calls.length;
      advance(1);
      expect(qrValue()).toBe(firstReplacementFrame);
      expect(nextPart).toHaveBeenCalledTimes(encodesAfterReplacement);
      advance(99);
      expect(qrValue()).toBe(secondReplacementFrame);
      expect(nextPart).toHaveBeenCalledTimes(encodesAfterReplacement + 1);

      view.unmount();
      expect(jest.getTimerCount()).toBe(0);
      advance(1000);
      expect(nextPart).toHaveBeenCalledTimes(encodesAfterReplacement + 1);
    },
  );
});
