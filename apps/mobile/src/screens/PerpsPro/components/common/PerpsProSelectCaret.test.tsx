import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/perps/PerpsProPrecisionCaret.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

const {
  PerpsProSelectCaret,
}: typeof import('./PerpsProSelectCaret') = require('./PerpsProSelectCaret');

describe('PerpsProSelectCaret', () => {
  it('centers the glyph at the approved rounded size in the shared 8x6 frame', () => {
    render(<PerpsProSelectCaret color="neutral-secondary" testID="caret" />);

    expect(StyleSheet.flatten(screen.getByTestId('caret').props.style)).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        height: 6,
        justifyContent: 'center',
        width: 8,
      }),
    );
    expect(screen.getByTestId('caret-glyph').props).toMatchObject({
      color: 'neutral-secondary',
      height: 4,
      width: 6,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('caret-glyph').props.style),
    ).toMatchObject({ transform: [{ rotate: '180deg' }] });
  });
});
