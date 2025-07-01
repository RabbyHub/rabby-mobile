import { WALLET_ICON, WALLET_NAME } from './constant';
import { setupMetamaskMode } from './metamaskMode';
import { compareVersions, domReadyCall } from './util';

type Rule = {
  matches: string[];
  hiddenSelectors?: string[];
  runner?(): void;
};

const hackRainbowkit = () => {
  const $metamaskBtn = document.querySelector(
    '[data-testid="rk-wallet-option-metaMask"]:not([rabby-injected])',
  );
  if (!$metamaskBtn) {
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

const hackRainbowkitMetamaskMode = () => {
  try {
    const rainbowkitVersion = window.localStorage.getItem('rk-version');
    if (rainbowkitVersion && compareVersions(rainbowkitVersion, '0.2.8') >= 0) {
      setupMetamaskMode();
    }
  } catch (e) {
    console.error(e);
  }
};

const rules: Rule[] = [
  {
    matches: [
      'https://rainbowkit.com',
      'https://app.spark.fi',
      'https://swap.defillama.com',
    ],
    runner: hackRainbowkit,
  },
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

    hackRainbowkitMetamaskMode();
  });
};
