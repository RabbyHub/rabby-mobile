import { clone } from 'lodash';

export const produce = (base, producer) => {
  const cloneObj = clone(base);
  producer(cloneObj);
  return cloneObj;
};
