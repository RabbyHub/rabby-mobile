import { Platform } from 'react-native';

const fontUrls = {
  antonRegulr: Platform.select({
    ios: 'Anton-Regular.ttf',
    android: 'file:///android_asset/fonts/Anton-Regular.ttf',
  }),
  sfPro: Platform.select({
    ios: 'SF-Pro-Text-Regular.ttf',
    android: 'file:///android_asset/fonts/SF-Pro-Text-Regular.ttf',
  }),
};

export const WEBVIEW_BUILTIN_FONT_CSS = `
@font-face {
  font-family: 'Anton-Regular';
  src: url('${fontUrls.antonRegulr}') format('truetype')
}

@font-face {
  font-family: 'SF-Pro';
  src: url('${fontUrls.sfPro}') format('truetype')
}

@font-face {
  font-family: 'SF Pro';
  src: url('${fontUrls.sfPro}') format('truetype')
}

:root {
  --default-font: 'SF Pro', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}

html, body {
  font-family: 'SF Pro', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
}
`;

export const WEBVIEW_BUILTIN_DARK_MODE_CSS = `
`;
