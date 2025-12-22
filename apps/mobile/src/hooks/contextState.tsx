import React from 'react';
import { noop } from 'lodash';
import { createContext, useContext, useState } from 'react';
import { zCreate } from '@/core/utils/reexports';

export function createContextState<T>(initialState: T, global = false) {
  if (global) {
    const zustandState = zCreate<T>(() => initialState);
    const useValueByZustand = () => zustandState();
    const useSetValueByZustand = () => zustandState.setState;
    const Provider = ({ children }: React.PropsWithChildren<unknown>) => {
      return <>{children}</>;
    };

    return [Provider, useValueByZustand, useSetValueByZustand] as const;
  }
  const StateContext = createContext<T>(initialState);
  const DispatchContext =
    createContext<React.Dispatch<React.SetStateAction<T>>>(noop);

  const useValue = () => useContext(StateContext);
  const useSetValue = () => useContext(DispatchContext);

  const Provider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [value, setValue] = useState(initialState);

    if (global) {
      return <>{children}</>;
    }

    return (
      <StateContext.Provider value={value}>
        <DispatchContext.Provider value={setValue}>
          {children}
        </DispatchContext.Provider>
      </StateContext.Provider>
    );
  };

  return [Provider, useValue, useSetValue] as const;
}
