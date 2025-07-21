import { WALLET_ICON, WALLET_NAME } from './constant';
import { setupMetamaskMode } from './metamaskMode';
import { domReadyCall, retry } from './util';

type Rule = {
  matches: string[];
  hiddenSelectors?: string[];
  runner?(): void;
};

const detectIsRainbowKit = (callback: () => void) => {
  const hasRainbowKit = () => window.localStorage.getItem('rk-version');
  if (hasRainbowKit()) {
    callback();
  } else {
    retry(
      async () => {
        if (!hasRainbowKit()) {
          throw new Error('not found rainbowkit');
        }
      },
      {
        retries: 10,
        delay: 300,
      },
    ).then(callback);
  }
};

const setupRainbowKitBtn = () => {
  const $rabbyBtn = document.querySelector(
    '[data-testid="rk-wallet-option-rabby"]',
  );
  const $metamaskBtn = document.querySelector(
    '[data-testid="rk-wallet-option-metaMask"]:not([rabby-injected])',
  );
  if ($rabbyBtn || !$metamaskBtn) {
    return;
  }
  const $imgEl = $metamaskBtn?.querySelector('img');
  if ($imgEl) {
    $imgEl.src = WALLET_ICON;
    $imgEl.alt = WALLET_NAME;
  }
  const $textEl = $metamaskBtn?.querySelector('h2 > span');
  if ($textEl) {
    $textEl.innerHTML = WALLET_NAME;
  }
  $metamaskBtn?.setAttribute('rabby-injected', 'true');
};

const hackRainbowkit = () => {
  detectIsRainbowKit(() => {
    localStorage.setItem('rk-recent', JSON.stringify(['rabby', 'metamask']));
    setupMetamaskMode({
      isKeepRabby: true,
    });
    setupRainbowKitBtn();

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            setupRainbowKitBtn();
          }
        });
      });
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
    });
  });
};

const hackMetamaskMode = async () => {
  const isMetamaskMode = await (window as any).rabby.request({
    method: 'rabby_getIsMetamaskMode',
    params: [],
  });
  if (isMetamaskMode) {
    setupMetamaskMode();
  }
};

const rules: Rule[] = [
  {
    matches: ['https://app.uniswap.org'],
    hiddenSelectors: [
      '#AppHeader ._display-flex._alignItems-stretch._flexBasis-auto._boxSizing-border-box._minHeight-0px._minWidth-0px._flexShrink-0._flexDirection-column._position-relative._zIndex-1020._pointerEvents-auto',
    ],
  },
  {
    matches: ['https://aerodrome.finance'],
    runner: () => {
      if (window.location.pathname !== '/connect') {
        return;
      }
      const $text = document.querySelector('button span.text-sm');
      if ($text?.textContent?.trim() !== 'Browser Wallet') {
        return;
      }
      $text.textContent = WALLET_NAME;
      const $parent = $text.parentNode;
      if (!$parent) {
        return;
      }
      const $img = document.createElement('img');
      $img.src = WALLET_ICON;
      $img.style.width = '24px';
      $img.style.height = '24px';
      $img.style.borderRadius = '24px';
      setTimeout(() => {
        const $svg = $parent.querySelector('svg');
        if ($svg) {
          $parent.replaceChild($img, $svg);
        }
      }, 500);
    },
  },
];

const injectStyle = (styleContent: string) => {
  const style = document.createElement('style');
  style.textContent = styleContent;
  document.head.appendChild(style);
};

export const startCheckRules = () => {
  domReadyCall(() => {
    const { origin } = window.location;
    const selectors: string[] = [];
    const runners: (() => void)[] = [];
    rules.forEach(item => {
      if (!item.matches.includes(origin.toLowerCase())) {
        return;
      }
      if (item.hiddenSelectors?.length) {
        selectors.push(...item.hiddenSelectors);
      }
      if (item.runner) {
        runners.push(item.runner);
      }
    });
    if (selectors?.length) {
      injectStyle(`${selectors.join(', ')} { display: none !important; }`);
    }
    if (runners.length) {
      const run = () => {
        runners.forEach(execute => {
          try {
            execute();
          } catch (e) {
            console.error(e);
          }
        });
      };
      run();
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              run();
            }
          });
        });
      });

      observer.observe(document, {
        childList: true,
        subtree: true,
      });
    }

    hackRainbowkit();
    hackMetamaskMode();
  });
};
