import { useMemo } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';

import MarkdownIt from 'markdown-it';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

const dMarkdownit = MarkdownIt({ typographer: true });

const TestRunFirst = `
  document.body.style.backgroundColor = 'red';
  setTimeout(function() { window.alert('hi') }, 2000);
  true; // note: this is required, or you'll sometimes get silent failures
`;

const getMarkdownPageStyle = createGetStyles(colors => {
  return `
  html, body {
    height: '100%';
    width: '100%';
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 0;
    use-select: none;
    overflow: hidden;
    overflow-y: auto;
    overflow-y: overlay;
    // outline: 1px solid blue;
  }

  .md-wrapper {
    color: ${colors['neutral-title-1']};
    font-family: "SF Pro";
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    text-align: left;
    padding-top: 0;
    use-select: none;
    overflow: hidden;
    padding-left: 20px;
  }

  ul li, ol li
  , p, a, blockquote, pre, code, img {
    color: ${colors['neutral-body']};
    font-family: "SF Pro";
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 24px;
  }

  h1, h2, h3, h4, h5, h6 {
    font-style: normal;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 0;
  }

  h1:first-child, h2:first-child, h3:first-child, h4:first-child, h5:first-child, h6:first-child {
    margin-top: 0;
  }

  h1 { font-size: 36px; }
  h2 { font-size: 32px; }
  h3 { font-size: 20px; }
  h4 { font-size: 16px; }
  h5 { font-size: 14px; }
  h6 { font-size: 12px; }

  ul { padding-left: 0; }
  ul li, ol li { padding-left: 0; }
  ul li { list-style-type: disc; }
  ol li { list-style-type: decimal; }
`;
});

export function MarkdownInWebView({
  markdown,
  markdownit = dMarkdownit,
}: React.PropsWithoutRef<{
  markdown: string;
  markdownit?: MarkdownIt;
}>) {
  const { styles, colors } = useThemeStyles(getStyles);

  const webviewHtml = useMemo(() => {
    const renderedHtml = markdownit.render(markdown);

    const style = getMarkdownPageStyle(colors);

    return `
  <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${style}</style>
    </head>
    <body>
      <div class="md-wrapper">
        ${renderedHtml}
      </div>
    </body>
  </html>`;
  }, [markdown, markdownit, colors]);

  return (
    <WebView
      style={styles.webview}
      originWhitelist={['*']}
      source={{
        html: webviewHtml,
        // html: '<h1>This is a static HTML source!</h1>',
      }}
      cacheEnabled={false}
      pullToRefreshEnabled={false}
      textInteractionEnabled={false}
      // injectedJavaScript={TestRunFirst}
    />
  );
}

const getStyles = createGetStyles(colors => {
  return {
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
      ...makeDebugBorder('orange'),
    },
  };
});
