export const normalizeTypedData = (data: {
  primaryType: string;
  types: Record<string, any>;
  domain: Record<string, any>;
  message: Record<string, any>;
}) => {
  if (
    typeof data.primaryType === 'string' &&
    typeof data.types === 'object' &&
    typeof data.message === 'object' &&
    typeof data.domain === 'object'
  ) {
    const normalized = Object.create(null) as typeof data;
    const domainFields = data.types.EIP712Domain.map(
      (field: { name: string }) => field.name,
    );
    const messageFields = data.types[data.primaryType].map(
      (field: { name: string }) => field.name,
    );
    normalized.domain = Object.fromEntries(
      Object.entries(data.domain).filter(([key]) => domainFields.includes(key)),
    );
    normalized.message = Object.fromEntries(
      Object.entries(data.message).filter(([key]) =>
        messageFields.includes(key),
      ),
    );
    normalized.primaryType = data.primaryType;
    normalized.types = data.types;
    return normalized;
  }

  return data;
};

export const parseSignTypedDataMessage = (raw: string | object) => {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!data.primaryType) {
    return data.message;
  }

  const { primaryType, message, types } = data;
  return filterPrimaryType({ primaryType, types, message });
};

export const filterPrimaryType = ({
  primaryType,
  types,
  message,
}: {
  primaryType: string;
  types: Record<string, any>;
  message: Record<string, any>;
}) => {
  const keys = types[primaryType];
  const filteredMessage: Record<string, string> = {};

  keys.forEach((key: { name: string; type: string }) => {
    filteredMessage[key.name] = message[key.name];
  });

  return filteredMessage;
};
