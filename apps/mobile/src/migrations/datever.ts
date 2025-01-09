export function enforceDate(input: any, fallbackValue = new Date()) {
  const result = {
    error: null as null | Error,
    dateValue: fallbackValue,
  };
  try {
    if (typeof input === 'string' || typeof input === 'number') {
      result.dateValue = new Date(input);
    }
  } catch (error) {
    result.error = error as Error;
    result.dateValue = fallbackValue;
  }

  return result;
}

// type DateVer =
//   `${number}${number}${number}${number}${number}${number}${number}${number}-${number}${number}${number}${number}${number}${number}`;
// function sortMigrationByDateVer(a: UTC0LikeVer, b: UTC0LikeVer) {
//   return bizNumberUtils.coerceInteger(a) < bizNumberUtils.coerceInteger(b) ? -1 : 1;
// }
export type UTC0LikeVer =
  `${number}${number}${number}${number}-${number}${number}-${number}${number}T${number}${number}:${number}${number}:${number}${number}Z`;
export function sortMigrationByUTC0DateVer(a: string, b: string) {
  let aDate = enforceDate(a, new Date(0)).dateValue;
  let bDate = enforceDate(b, new Date(0)).dateValue;

  return aDate.getTime() < bDate.getTime() ? -1 : 1;
}

export function isUsedDateVer(dateVer: string, curDateVer: string) {
  if (!curDateVer) return false;

  try {
    const curDateResult = enforceDate(curDateVer);
    if (curDateResult.error) {
      if (__DEV__) {
        throw new Error(`Invalid date version: ${curDateVer}`);
      } else {
        // treat it as outdated on production
        return true;
      }
    }

    // TODO: robust change
    const verDateResult = enforceDate(dateVer);
    if (verDateResult.error) return true;

    return (
      verDateResult.dateValue.getTime() <= curDateResult.dateValue.getTime()
    );
  } catch (error) {
    console.error(error);
    if (__DEV__) {
      throw error;
    } else {
      // treat it as outdated on production
      return true;
    }
  }
}
