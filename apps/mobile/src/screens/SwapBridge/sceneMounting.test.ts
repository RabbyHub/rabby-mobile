import {
  createInitialMountedSwapBridgeScenes,
  mountSwapBridgeScene,
} from './sceneMounting';

describe('SwapBridge scene mounting', () => {
  it.each(['swap', 'bridge'] as const)(
    'mounts only the initial %s scene',
    initialTab => {
      expect(createInitialMountedSwapBridgeScenes(initialTab)).toEqual({
        swap: initialTab === 'swap',
        bridge: initialTab === 'bridge',
      });
    },
  );

  it('keeps a scene mounted after it is first activated', () => {
    const initialScenes = createInitialMountedSwapBridgeScenes('swap');
    const mountedScenes = mountSwapBridgeScene(initialScenes, 'bridge');

    expect(mountedScenes).toEqual({
      swap: true,
      bridge: true,
    });
    expect(mountSwapBridgeScene(mountedScenes, 'swap')).toBe(mountedScenes);
  });
});
