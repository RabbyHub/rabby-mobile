export const devLog = (key: string, ...info: any) => {
  if (__DEV__) {
    console.log(`[${key}]`, ...info);
  }
};
