export const PERPS_PRO_FONT_FACE_FAMILY = 'Rabby SF Pro Rounded';

export const PERPS_PRO_FONT_FAMILY =
  `"${PERPS_PRO_FONT_FACE_FAMILY}", "SF Pro Rounded", ` +
  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const LIGHTWEIGHT_CHARTS_DEFAULT_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";

export const PERPS_PRO_FONT_STYLE_ELEMENT_ID = 'rabby-perps-pro-font-faces';

const PERPS_PRO_FONT_FILES = {
  regular: 'SF-Pro-Rounded-Regular.otf',
  medium: 'SF-Pro-Rounded-Medium.otf',
  bold: 'SF-Pro-Rounded-Bold.otf',
} as const;

type PerpsProFontRuntimeInfo = Pick<RuntimeInfo, 'platform' | 'runtimeBaseUrl'>;

export type PerpsProFontAssetUrls = {
  regular: string;
  medium: string;
  bold: string;
};

export function resolvePerpsProFontAssetUrls(
  runtimeInfo: PerpsProFontRuntimeInfo,
): PerpsProFontAssetUrls | null {
  const runtimeBaseUrl = runtimeInfo.runtimeBaseUrl.trim();
  if (!runtimeBaseUrl) {
    return null;
  }

  try {
    const baseUrlWithScheme = runtimeBaseUrl.startsWith('/')
      ? `file://${runtimeBaseUrl}`
      : runtimeBaseUrl;
    const baseUrl = new URL(
      baseUrlWithScheme.endsWith('/')
        ? baseUrlWithScheme
        : `${baseUrlWithScheme}/`,
    );
    if (baseUrl.protocol !== 'file:') {
      return null;
    }

    // Android keeps local pages below android_asset/custom while linked fonts
    // live in the sibling android_asset/fonts directory. iOS links the same
    // font files directly into the MainBundle root exposed by runtimeBaseUrl.
    const fontDirectory = runtimeInfo.platform === 'android' ? '../fonts/' : '';

    return {
      regular: new URL(
        `${fontDirectory}${PERPS_PRO_FONT_FILES.regular}`,
        baseUrl,
      ).href,
      medium: new URL(`${fontDirectory}${PERPS_PRO_FONT_FILES.medium}`, baseUrl)
        .href,
      bold: new URL(`${fontDirectory}${PERPS_PRO_FONT_FILES.bold}`, baseUrl)
        .href,
    };
  } catch {
    return null;
  }
}

export function createPerpsProFontFaceCss(urls: PerpsProFontAssetUrls): string {
  const createFace = (url: string, weight: 400 | 500 | 700) => `@font-face {
  font-family: "${PERPS_PRO_FONT_FACE_FAMILY}";
  src: url(${JSON.stringify(url)}) format("opentype");
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
}`;

  return [
    createFace(urls.regular, 400),
    createFace(urls.medium, 500),
    createFace(urls.bold, 700),
  ].join('\n');
}
