export const devLog = (key: string, ...info: any[]) => {
  if (__DEV__) {
    if (info.length === 0) {
      console.log(key);
    } else {
      console.log(`[${key}]`, ...info);
    }
  }
};
