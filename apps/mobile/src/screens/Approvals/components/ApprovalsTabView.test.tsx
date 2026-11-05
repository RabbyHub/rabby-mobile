import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { ApprovalsTabView } from './ApprovalsTabView';

jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 24 }),
}));
jest.mock('../useApprovalsPage', () => ({
  useApprovalsPage: () => ({
    safeSizeInfo: { safeSizes: { bottomAreaHeight: 120 } },
  }),
}));

afterEach(() => jest.restoreAllMocks());

it.each([
  ['ios', 0, 120],
  ['android', 40, 144],
] as const)(
  'preserves the platform-specific top and bottom space on %s',
  (os, expectedTop, expectedBottom) => {
    jest.replaceProperty(Platform, 'OS', os);
    const { getByTestId } = render(
      <ApprovalsTabView
        testID="tab-view"
        style={{ flex: 1 }}
        innerStyle={{ paddingHorizontal: 16 }}>
        <View testID="list" />
      </ApprovalsTabView>,
    );
    const style = StyleSheet.flatten(getByTestId('tab-view').props.style);
    expect(style.flex).toBe(1);
    expect(style.paddingTop).toBe(expectedTop);
    expect(style.paddingBottom).toBe(expectedBottom);
    expect(getByTestId('list')).toBeTruthy();
  },
);
