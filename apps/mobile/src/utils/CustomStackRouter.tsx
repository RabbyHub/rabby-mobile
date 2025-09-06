/**
 * @see https://github.com/react-navigation/react-navigation/blob/%40react-navigation/routers%407.5.1/packages/routers/src/StackRouter.tsx
 * @see file:///./../../node_modules/@react-navigation/routers/src/StackRouter.tsx
 */

import { StackRouter, StackRouterOptions } from '@react-navigation/native';

import deepEqual from 'fast-deep-equal';

export const CustomStackRouter = (options: StackRouterOptions) => {
  const router = StackRouter(options);
  const oldGetStateForAction = router.getStateForAction;
  router.getStateForAction = (state, action, options) => {
    const lastRoute = state.routes.at(-1);

    if (action.type === 'PUSH' && lastRoute) {
      const { name: lastName, params: lastParams } = lastRoute;
      const { name, params } = action.payload;
      if (name === lastName && deepEqual(params, lastParams)) {
        return null;
      }
    }
    return oldGetStateForAction(state, action, options);
  };

  return router;
};
