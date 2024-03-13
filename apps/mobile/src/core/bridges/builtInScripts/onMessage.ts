export const JS_LOG_ON_MESSAGE = `
;(function() {
  // log message from react native

  window.addEventListener('message', function(event) {
    console.debug('received event', event);
  });
})();
`;
