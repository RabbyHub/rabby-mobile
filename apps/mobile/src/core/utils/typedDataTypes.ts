// Names the signer treats as built-in when they are absent from `types`.
// Anchored at the start so an over-long key cannot trigger quadratic backtracking.
const BUILTIN_TYPE_REG =
  /^(address|bool|string|function|bytes\d*|u?int\d*|u?fixed(\d+x\d+)?)(\[\d*\])*$/;

/**
 * A struct declared under a built-in name is read as a struct by one EIP-712
 * implementation and as the built-in by another, so what gets parsed for
 * display may not be what gets signed. Returns the first such name, if any.
 */
export const findShadowedBuiltinType = (types: unknown): string | undefined => {
  if (!types || typeof types !== 'object') {
    return undefined;
  }
  return Object.keys(types).find(name => BUILTIN_TYPE_REG.test(name));
};

const ADDRESS_VALUE_REG = /^0x[0-9a-f]{1,40}$/i;

type TypedDataValue = { type: string; value: unknown };

function* getTypedDataChildren(
  { type, value }: TypedDataValue,
  fields: unknown,
): Generator<TypedDataValue> {
  if (Array.isArray(fields)) {
    for (const field of fields) {
      if (typeof field?.type !== 'string' || typeof field.name !== 'string') {
        continue;
      }
      // Match the signer's property lookup, including inherited fields.
      const member = (value as Record<string, unknown>)[field.name];
      if (member !== undefined) {
        yield { type: field.type, value: member };
      }
    }
  } else {
    const itemType = type.slice(0, type.lastIndexOf('['));
    for (const item of value as unknown[]) {
      yield { type: itemType, value: item };
    }
  }
}

export const hasInvalidTypedDataValue = (
  typedData?: {
    types?: Record<string, unknown>;
    primaryType?: unknown;
    domain?: unknown;
    message?: unknown;
  } | null,
): boolean => {
  if (!typedData?.types) {
    return false;
  }
  const { types, primaryType, domain, message } = typedData;
  const roots = [{ type: 'EIP712Domain', value: domain }];
  if (
    typeof primaryType === 'string' &&
    primaryType !== 'EIP712Domain' &&
    Array.isArray(types[primaryType])
  ) {
    roots.push({ type: primaryType, value: message });
  }

  const stack: Iterator<TypedDataValue>[] = [roots.values()];
  // Inherited properties can lead back to the same value under a recursive type.
  const visited = new Map<string, Set<unknown>>();
  while (stack.length) {
    const next = stack[stack.length - 1].next();
    if (next.done) {
      stack.pop();
      continue;
    }

    const { type, value } = next.value;
    const fields = types[type];
    if (fields === undefined && (type === 'string' || type === 'address')) {
      if (
        typeof value !== 'string' ||
        (type === 'address' && !ADDRESS_VALUE_REG.test(value))
      ) {
        return true;
      }
      continue;
    }

    if (
      value == null ||
      (!Array.isArray(fields) &&
        !(fields === undefined && Array.isArray(value) && type.endsWith(']')))
    ) {
      continue;
    }
    let seen = visited.get(type);
    if (seen?.has(value)) {
      continue;
    }
    if (!seen) {
      seen = new Set();
      visited.set(type, seen);
    }
    seen.add(value);
    stack.push(getTypedDataChildren(next.value, fields));
  }
  return false;
};

/**
 * `JSON.parse` keeps `__proto__` as a plain own key, but the signer's
 * `Object.assign` turns it into the prototype, so a type hidden there is
 * invisible to validation and display yet still resolved when signing.
 * Parses `data` and reports whether a `__proto__` key appears at any depth.
 */
export const parseTypedDataJson = (data: string) => {
  let hasProtoKey = false;
  const json = JSON.parse(data, (key, value) => {
    if (key === '__proto__') {
      hasProtoKey = true;
    }
    return value;
  });
  return { json, hasProtoKey };
};
