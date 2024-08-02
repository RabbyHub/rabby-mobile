import { clone } from 'lodash';

/**
 * @description produce a new object from the base object.
 *
 * shallow clone the base object and apply the producer function to the clone object
 *
 * @see https://immerjs.github.io/immer/produce/
 */
export const produce = <T = any>(base: T, producer: (draft: T) => void) => {
  const cloneObj = clone(base);
  producer(cloneObj);
  return cloneObj;
};
