export type FieldNilable<T> = {
  [P in keyof T]?: T[P] | null;
};

export type ItOrItsPromise<T> = T | Promise<T>;

export type MakeSurePromise<T> = T extends Promise<any> ? T : Promise<T>;
