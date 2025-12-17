import '../../imports';
import { postMessageToRN } from '../../utils/webview-runtime';
// import './index.less';
// import './index.css';

const clearRef = { current: 0 };
window.addEventListener('messageFromRN', function (event) {
  const message = (event as any as CustomEvent).detail as DuplexReceive;
  console.debug('[debug] onMessageFromRN event', message);

  switch (message.type) {
    case 'GOT_WINDOW_INFO': {
      const rootElement = document.documentElement;
      rootElement.style.setProperty(
        '--app-rect-width',
        `${message.info.width || rootElement.clientWidth}px`,
      );
      rootElement.style.setProperty(
        '--app-rect-height',
        `${message.info.height || rootElement.clientHeight}px`,
      );
      break;
    }
    case 'GASKETVIEW:TOGGLE_LOADING': {
      if (message.info.loading) {
        const rootElement = document.documentElement;
        const durationMs = parseInt(
          `${message.animationDurationMs || ''}` || '2500',
        );

        rootElement.style.setProperty('--app-animation-ms', `${durationMs}`);
        rootElement.style.setProperty(
          '--app-animation-color-rgb',
          message.info.isPositive ? '88, 198, 105' : '227, 73, 53',
        );

        document.body.classList.add('loading');
        if (clearRef.current) clearTimeout(clearRef.current);

        clearRef.current = setTimeout(() => {
          clearRef.current = 0;
          document.body.classList.remove('loading');
        }, durationMs);
      } else {
        // if there is a pending clear timeout, dont clear immediately
        if (!clearRef.current) {
          document.body.classList.remove('loading');
        }
      }
      break;
    }
  }
});

postMessageToRN({ type: 'GET_WINDOW_INFO' });
