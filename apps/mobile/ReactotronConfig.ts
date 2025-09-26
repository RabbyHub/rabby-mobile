import { setupReactotronConnection } from '@/core/utils/devServerSettings';

if (__DEV__) {
  setTimeout(() => {
    setupReactotronConnection();
  }, 100);
}
