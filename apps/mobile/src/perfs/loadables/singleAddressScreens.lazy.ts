import React from 'react';

import { registerAppScreen } from '@/perfs/apis';
import { SingleAddressLoadingScreen } from './SingleAddressLoadingScreen';

export const SingleAddressHomeScreen = registerAppScreen<
  typeof import('@/screens/Home/Home').default
>({
  loader: () => import('@/screens/Home/Home'),
  name: 'SingleAddressHomeScreen',
  placeholder: React.createElement(SingleAddressLoadingScreen),
});
