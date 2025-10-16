import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createStore, Provider } from 'jotai';
import { onDomReady } from './webview-runtime';

export const pageStore = createStore();

function withPageStore<T extends React.FC<any>>(Component: T) {
  return (props: React.ComponentProps<T>) => (
    <Provider store={pageStore}>
      <Component {...props} />
    </Provider>
  );
}

export async function bootstrapApp(App: React.FC) {
  const AppWithStore = withPageStore(App);

  return onDomReady().then(() => {
    return createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppWithStore />
      </StrictMode>,
    );
  });
}
