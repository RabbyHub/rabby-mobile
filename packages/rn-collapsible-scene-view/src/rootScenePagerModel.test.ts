import {
  beginRootSceneTouch,
  completeRootSceneMotion,
  createRootSceneMotion,
  finishRootSceneTouch,
  getRootSceneDragPosition,
  getRootSceneVisibleRange,
  requestRootSceneTarget,
  resolveRootSceneRelease,
  resolveRootSceneDragClaim,
  validateRootSceneKeys,
} from './rootScenePagerModel';

describe('root scene pager transport', () => {
  describe('manual-activation claim', () => {
    const base = { count: 2, backGestureEdge: 20 };

    it('waits below the 8pt slop and releases vertical drags', () => {
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          dx: 4,
          dy: 3,
          startX: 100,
          selected: 0,
        }),
      ).toBe('pending');
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          dx: 10,
          dy: 20,
          startX: 100,
          selected: 0,
        }),
      ).toBe('release');
    });

    it('edge-handoff yields the back-gesture edge on every page', () => {
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          dx: 30,
          dy: 2,
          startX: 12,
          selected: 0,
        }),
      ).toBe('release');
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          dx: 30,
          dy: 2,
          startX: 12,
          selected: 1,
        }),
      ).toBe('release');
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          dx: 30,
          dy: 2,
          startX: 120,
          selected: 0,
        }),
      ).toBe('claim');
      // A leftward drag starting on the edge still belongs to the pager.
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          dx: -30,
          dy: 2,
          startX: 12,
          selected: 0,
        }),
      ).toBe('claim');
      // Platforms without a native edge gesture keep the full claim.
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'edge-handoff',
          backGestureEdge: 0,
          dx: 30,
          dy: 2,
          startX: 12,
          selected: 0,
        }),
      ).toBe('claim');
    });

    it('boundary-handoff only releases the first/last page boundaries', () => {
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'boundary-handoff',
          dx: 30,
          dy: 2,
          startX: 12,
          selected: 0,
        }),
      ).toBe('release');
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'boundary-handoff',
          dx: -30,
          dy: 2,
          startX: 12,
          selected: 0,
        }),
      ).toBe('claim');
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'boundary-handoff',
          dx: -30,
          dy: 2,
          startX: 12,
          selected: 1,
        }),
      ).toBe('release');
      expect(
        resolveRootSceneDragClaim({
          ...base,
          gestureMode: 'boundary-handoff',
          dx: 30,
          dy: 2,
          startX: 12,
          selected: 1,
        }),
      ).toBe('claim');
    });
  });

  it('validates stable, nonempty unique keys', () => {
    expect(validateRootSceneKeys(['simple', 'pro'])).toBe('["simple","pro"]');
    expect(() => validateRootSceneKeys([])).toThrow();
    expect(() => validateRootSceneKeys([''])).toThrow();
    expect(() => validateRootSceneKeys(['a', 'a'])).toThrow();
  });
  it('preserves selection until a valid endpoint settles', () => {
    const start = createRootSceneMotion(0);
    const snap = requestRootSceneTarget(start, 1);
    expect(snap.selected).toBe(0);
    expect(completeRootSceneMotion(snap, snap.epoch - 1)).toBe(snap);
    expect(completeRootSceneMotion(snap, snap.epoch).selected).toBe(1);
  });
  it('latest command replaces a snap and fences its callback', () => {
    const first = requestRootSceneTarget(createRootSceneMotion(0), 2);
    const latest = requestRootSceneTarget(first, 1);
    expect(completeRootSceneMotion(latest, first.epoch)).toBe(latest);
    expect(completeRootSceneMotion(latest, latest.epoch).selected).toBe(1);
  });
  it('queues only the last command while the finger owns motion', () => {
    const down = beginRootSceneTouch(createRootSceneMotion(0), 0);
    const drag = { ...down, phase: 'drag' as const };
    const first = requestRootSceneTarget(drag, 2);
    const last = requestRootSceneTarget(first, 1);
    const released = finishRootSceneTouch(last, 0);
    expect(released.target).toBe(1);
    expect(released.queued).toBeNull();
    expect(released.selected).toBe(0);
  });
  it('a tap that never activates resumes a paused snap, not its source', () => {
    const snap = requestRootSceneTarget(createRootSceneMotion(0), 1);
    const paused = beginRootSceneTouch(snap, 0.4);
    expect(paused.startPosition).toBe(0.4);
    expect(completeRootSceneMotion(paused, snap.epoch)).toBe(paused);
    expect(finishRootSceneTouch(paused, paused.target).target).toBe(1);
  });
  it('a cancelled idle drag returns to the selected source', () => {
    const down = beginRootSceneTouch(createRootSceneMotion(1), 1);
    const drag = { ...down, phase: 'drag' as const };
    expect(finishRootSceneTouch(drag, drag.target).target).toBe(1);
  });
  it('grabs fractional motion without rounding and reverses continuously', () => {
    expect(getRootSceneDragPosition(0.4, 0, 400, 2)).toBe(0.4);
    expect(getRootSceneDragPosition(0.4, -80, 400, 2)).toBeCloseTo(0.6);
    expect(getRootSceneDragPosition(0.4, 80, 400, 2)).toBeCloseTo(0.2);
    expect(getRootSceneDragPosition(0.4, 400, 400, 2)).toBe(0);
    expect(getRootSceneDragPosition(0.4, -400, 400, 2)).toBe(1);
  });
  it('clamps one gesture to adjacent pages and keeps zero width safe', () => {
    expect(getRootSceneDragPosition(1, -1000, 400, 4)).toBe(2);
    expect(getRootSceneDragPosition(0, 100, 400, 4)).toBe(0);
    expect(getRootSceneDragPosition(1, 100, 0, 4)).toBe(1);
  });
  it.each([
    [0, 0.24, -96, 0, 0],
    [0, 0.25, -100, 0, 1],
    [0, 0.05, -20, -600, 1],
    [0, 0.02, -8, -2000, 0],
    [1, 0.76, 96, 0, 1],
    [1, 0.75, 100, 0, 0],
    [0.7, 0.49, 84, 0, 0],
    [0.7, 0.55, 60, 0, 1],
    [0.7, 0.55, 60, 700, 0],
  ])('resolves release %j', (start, position, dx, velocity, expected) => {
    expect(resolveRootSceneRelease(start, position, dx, velocity, 2)).toBe(
      expected,
    );
  });
  it('includes intermediate pages for a direct command, independent of child content', () => {
    expect(getRootSceneVisibleRange(0, 3, 4)).toEqual([0, 3]);
    expect(getRootSceneVisibleRange(0.4, 0.4, 4)).toEqual([0, 1]);
    expect(getRootSceneVisibleRange(2, 2, 4)).toEqual([2, 2]);
  });
});
