export type FieldNilable<T> = {
  [P in keyof T]?: T[P] | null;
};
