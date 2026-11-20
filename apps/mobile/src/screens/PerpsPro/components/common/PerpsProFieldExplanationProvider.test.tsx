import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

const mockSheet = jest.fn(
  ({
    explanationKey,
    onDismiss,
  }: {
    explanationKey: string;
    onDismiss: () => void;
  }) => (
    <View testID="field-explanation-sheet">
      <Text>{explanationKey}</Text>
      <Pressable onPress={onDismiss} testID="dismiss-explanation" />
    </View>
  ),
);

jest.mock('./PerpsProFieldExplanationSheet', () => ({
  PerpsProFieldExplanationSheet: (props: object) => mockSheet(props as any),
}));
jest.mock('./usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

import { usePerpsProFieldExplanation } from './PerpsProFieldExplanationContext';
import { PerpsProFieldExplanationProvider } from './PerpsProFieldExplanationProvider';

const Trigger = () => {
  const open = usePerpsProFieldExplanation();
  return (
    <Pressable onPress={() => open('markPrice')} testID="open-explanation" />
  );
};

describe('PerpsProFieldExplanationProvider', () => {
  it('owns one active explanation sheet and clears it on dismiss', () => {
    render(
      <PerpsProFieldExplanationProvider>
        <Trigger />
      </PerpsProFieldExplanationProvider>,
    );

    fireEvent.press(screen.getByTestId('open-explanation'));
    expect(screen.getByText('markPrice')).toBeTruthy();
    expect(screen.getAllByTestId('field-explanation-sheet')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('dismiss-explanation'));
    expect(screen.queryByTestId('field-explanation-sheet')).toBeNull();
  });

  it('drops an open explanation without unmounting its retained children', () => {
    const view = render(
      <PerpsProFieldExplanationProvider>
        <Trigger />
      </PerpsProFieldExplanationProvider>,
    );
    fireEvent.press(view.getByTestId('open-explanation'));
    expect(view.getByTestId('field-explanation-sheet')).toBeTruthy();
    view.rerender(
      <PerpsProFieldExplanationProvider sceneActive={false}>
        <Trigger />
      </PerpsProFieldExplanationProvider>,
    );
    expect(view.getByTestId('open-explanation')).toBeTruthy();
    expect(view.queryByTestId('field-explanation-sheet')).toBeNull();
    view.rerender(
      <PerpsProFieldExplanationProvider>
        <Trigger />
      </PerpsProFieldExplanationProvider>,
    );
    expect(view.queryByTestId('field-explanation-sheet')).toBeNull();
  });
});
