import { range } from 'lodash';

// use zero fill uncompleted data
export const patchCurveData = (
  data: {
    timestamp: number;
    price: number;
  }[],
  start: number,
  step: number,
) => {
  const end = data?.[0]?.timestamp || 0;
  if (start < end) {
    return range(start, end, step)
      .map(timestamp => {
        return {
          timestamp,
          price: 0,
        };
      })
      .concat(data);
  }
  return data;
};
