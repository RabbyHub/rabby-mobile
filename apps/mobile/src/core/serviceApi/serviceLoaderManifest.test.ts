import {
  assertServiceLoaderDependencyGraph,
  findServiceLoaderDependencyCycle,
  getCoreServiceLoaderDependencyGraph,
} from './serviceLoaderManifest';

describe('core service loader dependency manifest', () => {
  it('declares a valid dependency graph for every core service loader', () => {
    expect(() =>
      assertServiceLoaderDependencyGraph(getCoreServiceLoaderDependencyGraph()),
    ).not.toThrow();
  });

  it('keeps loader prerequisites explicit in the central manifest', () => {
    const graph = getCoreServiceLoaderDependencyGraph();

    expect(graph.autoConnectService).toEqual([
      'dappService',
      'keyringService',
      'preferenceService',
      'transactionHistoryService',
    ]);
    expect(graph.dappService).toEqual(['preferenceService']);
    expect(graph.notificationService).toEqual([
      'preferenceService',
      'transactionHistoryService',
    ]);
    expect(graph.sessionService).toEqual(['dappService']);
    expect(graph.transactionBroadcastWatcherService).toEqual([
      'transactionHistoryService',
      'transactionWatcherService',
    ]);
    expect(graph.transactionHistoryService).toEqual(['preferenceService']);
    expect(graph.transactionWatcherService).toEqual([
      'transactionHistoryService',
    ]);
  });

  it('reports the complete cycle path', () => {
    expect(
      findServiceLoaderDependencyCycle({
        alpha: ['beta'],
        beta: ['gamma'],
        gamma: ['alpha'],
      }),
    ).toEqual(['alpha', 'beta', 'gamma', 'alpha']);
  });

  it('rejects dependencies that are absent from the manifest', () => {
    expect(() =>
      assertServiceLoaderDependencyGraph({
        alpha: ['missing'],
      }),
    ).toThrow('depends on unknown service "missing"');
  });

  it('rejects dependency cycles before loaders are registered', () => {
    expect(() =>
      assertServiceLoaderDependencyGraph({
        alpha: ['beta'],
        beta: ['alpha'],
      }),
    ).toThrow('Core service loader dependency cycle: alpha -> beta -> alpha');
  });
});
