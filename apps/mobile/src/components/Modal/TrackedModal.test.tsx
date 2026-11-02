import React from 'react';
import { act, render } from '@testing-library/react-native';
// eslint-disable-next-line no-restricted-imports -- drive the native modal lifecycle in this wrapper test.
import { Modal, Platform, View } from 'react-native';

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));

import {
  getVisibleBlockingModalIds,
  MODAL_GATE_IDS,
  resetModalGateForTests,
} from '@/utils/modalGate';

import { TrackedModal } from './TrackedModal';

const MODAL_ID = MODAL_GATE_IDS.tokenDetailHeaderMenu;
const originalOS = Platform.OS;

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

describe('TrackedModal', () => {
  beforeEach(() => {
    resetModalGateForTests();
    setPlatform('ios');
  });

  afterEach(() => {
    setPlatform(originalOS);
    resetModalGateForTests();
  });

  it('keeps the iOS gate until the native modal reports dismissal', () => {
    const view = render(
      <TrackedModal modalId={MODAL_ID} visible>
        <View />
      </TrackedModal>,
    );

    expect(getVisibleBlockingModalIds()).toEqual([MODAL_ID]);

    view.rerender(
      <TrackedModal modalId={MODAL_ID} visible={false}>
        <View />
      </TrackedModal>,
    );
    expect(getVisibleBlockingModalIds()).toEqual([MODAL_ID]);

    act(() => view.UNSAFE_getByType(Modal).props.onDismiss?.());
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });

  it('releases the Android gate as soon as the modal is hidden', () => {
    setPlatform('android');
    const view = render(
      <TrackedModal modalId={MODAL_ID} visible>
        <View />
      </TrackedModal>,
    );

    expect(getVisibleBlockingModalIds()).toEqual([MODAL_ID]);

    view.rerender(
      <TrackedModal modalId={MODAL_ID} visible={false}>
        <View />
      </TrackedModal>,
    );
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });

  it('releases the gate if the modal unmounts while visible', () => {
    const view = render(
      <TrackedModal modalId={MODAL_ID} visible>
        <View />
      </TrackedModal>,
    );

    expect(getVisibleBlockingModalIds()).toEqual([MODAL_ID]);
    view.unmount();
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });
});
