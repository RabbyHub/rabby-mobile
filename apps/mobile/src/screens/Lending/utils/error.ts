export const isUserCancelledError = (err: any): boolean => {
  const errMsg = err?.message || '';
  if (typeof errMsg === 'string') {
    return errMsg.includes('User rejected the request');
  }
  return false;
};
