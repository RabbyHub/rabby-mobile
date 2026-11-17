/** Namespace for independent Scale limits; no persisted strategy/group identity. */
const SCALE_PREFIX = '5ca1e001';
const SCALE_PATTERN = new RegExp(`^0x${SCALE_PREFIX}[0-9a-f]{24}$`, 'i');
export const isPerpsScaleCloid = (value: unknown): value is `0x${string}` =>
  typeof value === 'string' && SCALE_PATTERN.test(value);

export const createPerpsScaleCloid = (uuid: string): `0x${string}` => {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex))
    throw new Error('Invalid Scale order identifier');
  return `0x${SCALE_PREFIX}${hex.slice(8)}`;
};
