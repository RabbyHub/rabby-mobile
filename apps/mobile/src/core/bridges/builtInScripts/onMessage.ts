export const JS_LOG_ON_MESSAGE = `
(function() {
  // log message from react native

  window.addEventListener('message', function(event) {
    console.log('received event.data', event.data);
  });
})();
`;
