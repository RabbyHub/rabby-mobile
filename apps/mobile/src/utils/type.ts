import { Atom } from 'jotai';

export type IExtractFromPromise<T> = T extends Promise<infer U> ? U : T;

export type ObjectMirror<T> = {
  [K in keyof T]: T[K];
};

export type RefLikeObject<T> = { current: T };

export type ExtractAtomValueType<T> = T extends Atom<infer V> ? V : never;
