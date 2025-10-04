import React, { useMemo, useRef } from 'react';

type AsMap<A extends string = string> = Record<A, any>;
export type AsName<T extends AsMap> = Exclude<keyof T, number | symbol>;

type Process$$typeof<T> = T extends React.RefAttributes<infer Com>
  ? Omit<T, 'ref'> & { ref?: React.Ref<Omit<Com, '$$typeof'>> }
  : T extends { $$typeof: any }
  ? Omit<T, '$$typeof'>
  : T;

type ExoticComponentPure<P = {}> = {
  (props: P): React.ReactNode;
};

function getComponentByAs<A extends string, T extends AsMap<A>>(
  as: A,
  asMap: T,
): T[A] extends React.ExoticComponent<infer P>
  ? ExoticComponentPure<Process$$typeof<P>>
  : T[A] {
  const Component = asMap[as];

  if (!Component) {
    const errMsg = `Invalid as prop: ${as} for Components: ${Object.keys(
      asMap,
    ).join(', ')}`;
    if (__DEV__) {
      throw new Error(errMsg);
    } else {
      console.warn(errMsg);
      return React.Fragment as unknown as T[A];
    }
  }

  return Component;
}

export type MakePropsByAsMap<T extends AsMap, A extends AsName<T>> = {
  as?: A;
} & React.ComponentProps<T[A]>;

export function useComponentByAsProp<T extends AsMap>(as: AsName<T>, asMap: T) {
  const Component = useMemo(() => {
    return getComponentByAs(as, asMap);
  }, [as, asMap]);

  return {
    Component,
  };
}

// export type GetComponentRef<T extends React.ElementType> =
//   T extends React.MemoExoticComponent<
//     React.ForwardRefExoticComponent<T> & React.RefAttributes<infer Method>
//   >
//     ? Process$$typeof<Method>
//     : T extends React.ForwardRefExoticComponent<
//         React.ComponentPropsWithoutRef<T> & React.RefAttributes<infer Method>
//       >
//     ? Process$$typeof<Method>
//     : T extends React.NamedExoticComponent<
//         React.ComponentPropsWithoutRef<T> & React.RefAttributes<infer Method>
//       >
//     ? Process$$typeof<Method>
//     : React.ComponentPropsWithRef<T> extends React.RefAttributes<infer Method>
//     ? Process$$typeof<Method>
//     : never;

export function useComponentRefByAsProp<T extends AsMap>(
  as: AsName<T>,
  asMap: T,
) {
  const Component = useMemo(() => {
    return getComponentByAs(as, asMap);
  }, [as, asMap]);

  const comRef = useRef<React.ComponentRef<T[typeof as]>>(null);

  return {
    Component,
    comRef,
  };
}
