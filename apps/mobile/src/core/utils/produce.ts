import { cloneDeep } from 'lodash';

/**
 * @description produce a new object from the base object.
 *
 * deep clone the base object and apply the producer function to the clone object
 *
 * @see https://immerjs.github.io/immer/produce/
 */
export const produce = <T = any>(base: T, producer: (draft: T) => void) => {
  const cloneObj = cloneDeep(base);
  producer(cloneObj);
  return cloneObj;
};
