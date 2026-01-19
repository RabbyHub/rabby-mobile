import { trigger } from 'react-native-haptic-feedback';

export const getOriginName = (origin: string) => {
  const matches = origin.replace(/https?:\/\//, '').match(/^([^.]+\.)?(\S+)\./);

  return matches ? matches[2] || origin : origin;
};

export const hashCode = (str: string) => {
  if (!str) {
    return 0;
  }
  let hash = 0,
    i,
    chr,
    len;
  if (str.length === 0) {
    return hash;
  }
  for (i = 0, len = str.length; i < len; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};
export const lowcaseSame = (a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
};

export const triggerImpact = () => {
  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
};
