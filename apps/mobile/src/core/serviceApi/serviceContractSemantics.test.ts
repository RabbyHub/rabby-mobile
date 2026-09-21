import {
  coreServiceContractCatalog,
  getCoreServiceMethodSemantic,
} from './serviceContractSemantics';

describe('service contract semantics', () => {
  it('covers dependency-only and deferred API services', () => {
    expect(coreServiceContractCatalog.browserHistoryService.access).toBe(
      'dependency-only',
    );
    expect(coreServiceContractCatalog.dappService.apiExport).toBe(
      'dappServiceApi',
    );
    expect(coreServiceContractCatalog.keyringService.higherReadiness).toEqual([
      'runtimeReady',
    ]);
  });

  it('classifies conventional and exceptional methods', () => {
    expect(getCoreServiceMethodSemantic('dappService', 'getDapp')).toBe(
      'query',
    );
    expect(getCoreServiceMethodSemantic('dappService', 'updateDapp')).toBe(
      'command',
    );
    expect(
      getCoreServiceMethodSemantic('customRPCService', 'requestCustomRPC'),
    ).toBe('query');
    expect(
      getCoreServiceMethodSemantic('securityEngineService', 'execute'),
    ).toBe('query');
    expect(
      getCoreServiceMethodSemantic('dappService', 'unknownMethodShape'),
    ).toBe('unknown');
  });
});
