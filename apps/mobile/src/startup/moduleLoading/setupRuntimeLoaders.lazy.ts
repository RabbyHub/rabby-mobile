export const setupRuntimeLoaders = {
  readableAccountBootstrap: () =>
    import('@/setup-readable-account-bootstrap-warmups'),
  readableAccountStores: () => import('@/setup-readable-account-stores'),
  setupBeforeRender: () => import('@/setup-app-before-render.runtime'),
} as const;
