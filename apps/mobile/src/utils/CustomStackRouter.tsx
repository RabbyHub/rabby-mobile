// https://github.com/react-navigation/react-navigation/blob/b2fa62c8ea5c5ad40a3541a7258cba62467e7a56/packages/routers/src/StackRouter.tsx

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
