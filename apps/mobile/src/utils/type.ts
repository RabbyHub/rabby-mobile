export type IExtractFromPromise<T> = T extends Promise<infer U> ? U : T;

export type ObjectMirror<T> = {
  [K in keyof T]: T[K];
};
