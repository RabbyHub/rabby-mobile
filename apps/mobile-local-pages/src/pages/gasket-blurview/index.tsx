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
        document.body.classList.add('loading');
        if (clearRef.current) clearTimeout(clearRef.current);

        const ms = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--animation-ms',
          ) || '4000',
        );
        clearRef.current = setTimeout(() => {
          clearRef.current = 0;
          document.body.classList.remove('loading');
        }, ms);
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
