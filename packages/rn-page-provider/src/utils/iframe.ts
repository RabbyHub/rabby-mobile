export const isInIframe = () => {
  return window.self !== window.top;
};

export const isInSameOriginIframe = () => {
  if (!isInIframe()) {
    return false;
  }

  try {
    return window.self.location.origin === window.top?.location?.origin;
  } catch (e) {
    return false;
  }
};
