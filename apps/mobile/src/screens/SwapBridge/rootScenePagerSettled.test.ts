// Deep import keeps the pager component (and its native gesture module out of
// this pure-model test.
import { shouldPublishRootSceneSettled } from '@rabby-wallet/rn-collapsible-scene-view/src/rootScenePagerModel';

describe('shouldPublishRootSceneSettled', () => {
  test('echoes a normal page change', () => {
    expect(shouldPublishRootSceneSettled('swap', 'bridge', 'bridge')).toBe(
      true,
    );
  });

  test('does not echo the settle the parent already knows', () => {
    expect(shouldPublishRootSceneSettled('bridge', 'bridge', 'bridge')).toBe(
      false,
    );
  });

  test('repairs a command that was interrupted back to its source page', () => {
    // Header asked for Bridge, the user dragged back to Swap before the snap
    // settled: the pager never left Swap but the route is still on Bridge.
    expect(shouldPublishRootSceneSettled('swap', 'bridge', 'swap')).toBe(true);
  });

  test('keeps echoing when only the outstanding request differs', () => {
    expect(shouldPublishRootSceneSettled('swap', 'nft', 'swap')).toBe(true);
  });
});
