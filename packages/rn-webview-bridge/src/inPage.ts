export function webviewInPagePostMessage (data: any = null, pageOrigin: string = window.location.href) {
  return window.ReactNativeWebView.postMessage(
    JSON.stringify({
      data,
      origin: pageOrigin,
    }),
  );
}
