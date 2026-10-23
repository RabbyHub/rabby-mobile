import { renderHook } from '@testing-library/react-native';

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));

import {
  acquireBlockingModal,
  getVisibleBlockingModalIds,
  MODAL_GATE_IDS,
  resetModalGateForTests,
  useRegisterBlockingModal,
} from './modalGate';

const perpsEditorIds = [
  ['perpsProBasicOrderEdit', 'perps-pro-basic-order-edit'],
  ['perpsProConditionalOrderEdit', 'perps-pro-conditional-order-edit'],
  [
    'perpsProOpenOrderEditConfirmation',
    'perps-pro-open-order-edit-confirmation',
  ],
  ['perpsProPositionTpSlConfirmation', 'perps-pro-position-tpsl-confirmation'],
] as const;

describe('Perps Pro modal gate catalog', () => {
  beforeEach(resetModalGateForTests);
  afterEach(resetModalGateForTests);

  it.each(perpsEditorIds)(
    'registers and releases %s by its existing sheet ID',
    (key, id) => {
      expect(MODAL_GATE_IDS[key]).toBe(id);
      const hook = renderHook(
        ({ visible }) => useRegisterBlockingModal(id, visible),
        { initialProps: { visible: false } },
      );
      expect(getVisibleBlockingModalIds()).toEqual([]);
      hook.rerender({ visible: true });
      expect(getVisibleBlockingModalIds()).toEqual([id]);
      hook.rerender({ visible: false });
      expect(getVisibleBlockingModalIds()).toEqual([]);
      hook.rerender({ visible: true });
      hook.unmount();
      expect(getVisibleBlockingModalIds()).toEqual([]);
    },
  );

  it('keeps distinct editor and confirmation gates until each owner releases them', () => {
    const ids = perpsEditorIds.map(([key]) => MODAL_GATE_IDS[key]);
    const releases = ids.map(id => acquireBlockingModal(id));
    const releaseSecondBasicEditor = acquireBlockingModal(ids[0]);
    expect(getVisibleBlockingModalIds()).toEqual(ids);

    releases[0]();
    releases[0]();
    expect(getVisibleBlockingModalIds()).toEqual(ids);
    releaseSecondBasicEditor();
    expect(getVisibleBlockingModalIds()).toEqual(ids.slice(1));

    releases.slice(1).forEach(release => release());
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });
});
