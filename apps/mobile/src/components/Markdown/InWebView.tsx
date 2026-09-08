import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';
import WebView from 'react-native-webview';

import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { WEBVIEW_BUILTIN_FONT_CSS } from '@/constant/webviewCss';
import { AppColorsVariants } from '@/constant/theme';
import { Text } from '@/components/Typography';
import { MARKDOWN_FALLBACK_TEXT, parseMarkdown } from './parseMarkdown';
import type { MarkdownParseResult } from './parseMarkdown';

const getMarkdownPageStyle = (colors: AppColorsVariants) => {
  return `${WEBVIEW_BUILTIN_FONT_CSS}
  html, body {
    height: '100%';
    width: '100%';
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 0;
    margin: 0;
    use-select: none;
    overflow: hidden;
    overflow-y: auto;
    overflow-y: overlay;
    background-color: ${colors['neutral-bg-1']};
    // outline: 1px solid blue;
  }

  .md-wrapper {
    color: ${colors['neutral-body']};
    font-family: var(--default-font);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 24px;
    text-align: left;
    padding-top: 0;
    use-select: none;
    overflow: hidden;
    padding-left: 5px;
    overflow-wrap: anywhere;
  }

  .md-wrapper h1, .md-wrapper h2, .md-wrapper h3,
  .md-wrapper h4, .md-wrapper h5, .md-wrapper h6 {
    color: ${colors['neutral-title-1']};
    font-weight: 600;
    line-height: 1.4;
    margin: 16px 0 8px;
  }

  .md-wrapper h1 { font-size: 28px; }
  .md-wrapper h2 { font-size: 22px; }
  .md-wrapper h3 { font-size: 18px; }
  .md-wrapper h4 { font-size: 16px; }
  .md-wrapper h5 { font-size: 15px; }
  .md-wrapper h6 { font-size: 14px; }
  .md-wrapper > :first-child { margin-top: 0; }

  .md-wrapper p {
    margin: 0;
    font-size: 14px;
    line-height: 18px;
    white-space: pre-wrap;
  }

  .md-wrapper ul, .md-wrapper ol {
    margin: 0;
    padding-left: 22px;
  }

  .md-wrapper li {
    padding-left: 2px;
    font-size: 14px;
    line-height: 18px;
    margin: 4px 0;
  }
`;
};

export function MarkdownInWebView({
  markdown,
  parsedMarkdown,
  htmlInnerStyle,
  webviewStyle,
  onWebViewError,
}: React.PropsWithoutRef<{
  markdown: string;
  parsedMarkdown?: MarkdownParseResult;
  htmlInnerStyle?: string;
  webviewStyle?: StyleProp<ViewStyle>;
  onWebViewError?: () => void;
}>) {
  const { styles, colors } = useThemeStyles(getStyles);
  const parsed = useMemo(
    () => parsedMarkdown ?? parseMarkdown(markdown),
    [markdown, parsedMarkdown],
  );
  const [failedHtml, setFailedHtml] = useState<string | null>(null);

  const webviewHtml = useMemo(() => {
    const webviewCss = getMarkdownPageStyle(colors);

    return `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${webviewCss}</style>
      ${htmlInnerStyle ? `<style>${htmlInnerStyle}</style>` : ''}
    </head>
    <body>
      <div class="md-wrapper">${parsed.html}</div>
    </body>
  </html>`;
  }, [parsed.html, htmlInnerStyle, colors]);

  const handleWebViewError = useCallback(() => {
    setFailedHtml(webviewHtml);
    onWebViewError?.();
  }, [webviewHtml, onWebViewError]);

  if (!parsed.success || failedHtml === webviewHtml) {
    return (
      <ScrollView
        style={[styles.webview, webviewStyle]}
        contentContainerStyle={styles.fallbackContent}>
        <Text style={styles.fallbackText}>{MARKDOWN_FALLBACK_TEXT}</Text>
      </ScrollView>
    );
  }

  return (
    <WebView
      style={[styles.webview, webviewStyle]}
      originWhitelist={['*']}
      source={{
        baseUrl: '',
        html: webviewHtml,
        // html: '<h1>This is a static HTML source!</h1>',
      }}
      webviewDebuggingEnabled={__DEV__}
      cacheEnabled={false}
      pullToRefreshEnabled={false}
      textInteractionEnabled={false}
      javaScriptEnabled={false}
      dataDetectorTypes="none"
      onError={handleWebViewError}
      onRenderProcessGone={handleWebViewError}
      onContentProcessDidTerminate={handleWebViewError}
    />
  );
}

const getStyles = createGetStyles(colors => {
  return {
    fallbackContent: {
      paddingHorizontal: 10,
    },
    fallbackText: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 18,
    },
    container: {
      flex: 1,
      height: '100%',
      width: '100%',
      opacity: 1,
    },
    webview: {
      minHeight: 200,
      maxHeight: '100%',
      height: '100%',
      width: '100%',
      backgroundColor: colors['neutral-bg-1'],
      // ...makeDebugBorder('orange'),
    },
  };
});
