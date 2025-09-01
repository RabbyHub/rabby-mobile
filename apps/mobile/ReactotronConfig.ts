import { setupReactotronConnection } from '@/core/utils/devReactotron';

if (__DEV__) {
  setTimeout(() => {
    setupReactotronConnection();
  }, 100);
}
