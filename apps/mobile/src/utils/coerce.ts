export function coerceNumber(val: any, fallbackNum = 0) {
  val = val || 0;
  val = parseFloat(val);
  if (isNaN(val)) {
    return fallbackNum;
  }

  if (typeof val === 'number') {
    return val;
  }

  return fallbackNum;
}

export function coerceSecond(val: any, fallbackMS = Date.now()) {
  const num = coerceNumber(val, fallbackMS / 1e3);

  return num;
}
