import { createStoreActivityScope } from './storeActivity';
import {
  getLatestStoreActivityScopeDiagnostics,
  getStoreActivityDiagnosticsSnapshot,
  registerStoreActivityScope,
} from './storeActivityDiagnostics';

jest.mock('@/core/utils/diagnosticEnv', () => ({
  isNonProductionDiagnosticsEnabled: true,
}));

describe('store activity diagnostics', () => {
  it('registers scopes without subscribing to their stores', () => {
    const scope = createStoreActivityScope({ active: false, label: 'home' });
    const unregister = registerStoreActivityScope(scope);

    expect(getStoreActivityDiagnosticsSnapshot()).toEqual({
      enabled: true,
      scopes: [
        {
          label: 'home',
          active: false,
          stores: [],
        },
      ],
    });
    expect(getLatestStoreActivityScopeDiagnostics('home')).toEqual({
      label: 'home',
      active: false,
      stores: [],
    });

    unregister();
    expect(getLatestStoreActivityScopeDiagnostics('home')).toBeNull();
  });
});
