import { isSwapBridgeSceneActive } from './sceneActivation';

describe('isSwapBridgeSceneActive', () => {
  it('activates only the visible scene on a focused screen', () => {
    expect(
      isSwapBridgeSceneActive({
        activeTab: 'swap',
        scene: 'swap',
        screenFocused: true,
      }),
    ).toBe(true);
    expect(
      isSwapBridgeSceneActive({
        activeTab: 'swap',
        scene: 'bridge',
        screenFocused: true,
      }),
    ).toBe(false);
  });

  it('deactivates both scenes when the route loses focus', () => {
    expect(
      isSwapBridgeSceneActive({
        activeTab: 'bridge',
        scene: 'swap',
        screenFocused: false,
      }),
    ).toBe(false);
    expect(
      isSwapBridgeSceneActive({
        activeTab: 'bridge',
        scene: 'bridge',
        screenFocused: false,
      }),
    ).toBe(false);
  });
});
