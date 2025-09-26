export type FieldNilable<T> = {
  [P in keyof T]?: T[P] | null;
};

export type ItOrItsPromise<T> = T | Promise<T>;

export type MakeSurePromise<T> = T extends Promise<any> ? T : Promise<T>;

export type ClassOf<I, Args extends any[] = any[]> = new (...args: Args) => I;

export type ReactSetStateValueOrFunc <T> = T | ((prev: T) => T);
