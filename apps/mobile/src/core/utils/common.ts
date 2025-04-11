export const underline2Camelcase = (str: string) => {
  return str.replace(/_(.)/g, (m, p1) => p1.toUpperCase());
};
