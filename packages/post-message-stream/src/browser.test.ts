import * as PostMessageStream from './browser';

describe('post-message-stream', () => {
  describe('browser exports', () => {
    const expectedExports = [
      'BasePostMessageStream',
      'WindowPostMessageStream',
      'BrowserRuntimePostMessageStream',
    ];

    it('package has expected exports', () => {
      expect(Object.keys(PostMessageStream)).toHaveLength(
        expectedExports.length,
      );

      for (const exportName of expectedExports) {
        expect(exportName in PostMessageStream).toBe(true);
      }
    });
  });
});
