import type { Ref } from 'react';

export type SwitchToggleType = {
  toggle: (enabled?: boolean) => void | Promise<void>;
};

export type SwitchToggleRefProp = {
  // React 19 passes ref to function components as a prop.
  ref?: Ref<SwitchToggleType>;
};
