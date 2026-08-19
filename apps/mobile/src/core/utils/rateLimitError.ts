const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const isRateLimitStatus = (value: unknown) => value === 429 || value === '429';

export const isHttpRateLimitedError = (error: unknown): boolean => {
  const record = asRecord(error);
  const response = asRecord(record?.response);
  if (
    isRateLimitStatus(record?.status) ||
    isRateLimitStatus(record?.statusCode) ||
    isRateLimitStatus(response?.status) ||
    isRateLimitStatus(response?.statusCode)
  ) {
    return true;
  }

  const message =
    typeof record?.message === 'string'
      ? record.message
      : typeof error === 'string'
      ? error
      : '';
  if (/(?:HTTP|status(?: code)?)[^\d]{0,12}429(?:\D|$)/i.test(message)) {
    return true;
  }

  return (
    !!record?.cause &&
    record.cause !== error &&
    isHttpRateLimitedError(record.cause)
  );
};
