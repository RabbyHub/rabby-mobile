import { isNonPublicProductionEnv } from '@/constant';

type TaggedTime = {
  [tag: string]: [number, number];
};
const taggedTime = {} as TaggedTime;

type PreDefindTag = 'UnlockWithPassword' | 'UnlockWithBiometrics';
function startMeasureTime<T extends PreDefindTag>(tag: T) {
  const startTime = Date.now();
  taggedTime[tag] = [startTime, -1];
}

function endMessureTime<T extends PreDefindTag>(tag: T) {
  const endTime = Date.now();
  const ret = { diff: 0, startTime: 0, endTime: 0 };
  if (!taggedTime[tag]) {
    const errMsg = `Tag ${tag} not found, please call startMeasureTime first`;
    if (isNonPublicProductionEnv) throw new Error(errMsg);
    else {
      console.warn(errMsg);
    }
  }

  const item = taggedTime[tag]!;

  item[1] = endTime;

  ret.diff = item[1] - item[0];
  ret.startTime = item[0];
  ret.endTime = item[1];

  delete taggedTime[tag];

  return ret;
}

export const measureTime = {
  start: startMeasureTime,
  end: endMessureTime,
};
