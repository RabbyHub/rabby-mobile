import React from 'react';
import { noop } from 'lodash';
import { createContext, useContext, useState } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';

export function createContextState<T>(initialState: T, jotai = false) {
  if (jotai) {
    const atomState = atom(initialState);
    const useValueByJotai = () => useAtomValue(atomState);
    const useSetValueByJotai = () => useSetAtom(atomState);
    const Provider = ({ children }: React.PropsWithChildren<unknown>) => {
      return <>{children}</>;
    };

    return [Provider, useValueByJotai, useSetValueByJotai] as const;
  }
  const StateContext = createContext<T>(initialState);
  const DispatchContext =
    createContext<React.Dispatch<React.SetStateAction<T>>>(noop);

  const useValue = () => useContext(StateContext);
  const useSetValue = () => useContext(DispatchContext);

  const Provider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [value, setValue] = useState(initialState);

    if (jotai) {
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
