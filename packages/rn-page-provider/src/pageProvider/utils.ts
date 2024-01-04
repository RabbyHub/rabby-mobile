const domReadyCall = (callback) => {
  if (document.readyState === "loading") {
    const domContentLoadedHandler = () => {
      callback();
      document.removeEventListener("DOMContentLoaded", domContentLoadedHandler);
    };
    document.addEventListener("DOMContentLoaded", domContentLoadedHandler);
  } else {
    callback();
  }
};

const $ = document.querySelector.bind(document);

export { domReadyCall, $ };
