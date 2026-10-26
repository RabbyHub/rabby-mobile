import * as readableAccountBootstrap from '@/setup-readable-account-bootstrap-warmups';
import * as readableAccountStores from '@/setup-readable-account-stores';
import * as setupBeforeRender from '@/setup-app-before-render.runtime';

export const setupRuntimeLoaders = {
  readableAccountBootstrap: () => Promise.resolve(readableAccountBootstrap),
  readableAccountStores: () => Promise.resolve(readableAccountStores),
  setupBeforeRender: () => Promise.resolve(setupBeforeRender),
} as const satisfies typeof import('./setupRuntimeLoaders.lazy').setupRuntimeLoaders;
