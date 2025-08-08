import { domReadyCall } from './util';

function getURLFromPing(selector) {
  const a = selector;
  if (!(a instanceof HTMLAnchorElement)) {
    return null;
  }
  if (a.ping) {
    try {
      return new URL(a.ping, window.location.href).searchParams.get('url');
    } catch {
      return null;
    }
  }
  const href = a.getAttribute('href');
  if (href) {
    try {
      new URL(href);
      return href;
    } catch {
      return null;
    }
  }
  return null;
}

function getURLFromQuery(selector) {
  const a = selector;
  if (!(a instanceof HTMLAnchorElement)) {
    return null;
  }
  const url = a.href;
  if (!url) {
    return null;
  }
  const u = new URL(url);
  return u.origin === window.location.origin
    ? u.pathname === '/url'
      ? u.searchParams.get('q')
      : u.pathname === '/imgres' || u.pathname === '/search'
      ? null
      : url
    : url;
}

const injectCss = () => {
  try {
    if (document.querySelector('style[data-inject-rabby]') || !document.head) {
      return;
    }
    const $style = document.createElement('style');
    $style.setAttribute('data-inject-rabby', 'true');

    $style.innerHTML = `
/* header */
.Fh5muf {
  display: none !important;
}
  #rso {
    padding-top: 8px;
  }

/* tab bar*/
.gDIH3 {
  display: none !important;
}

/* login modal */
#lb {
  display: none !important;
}

/* jump popup */
#stUuGf {
  display: none !important;
}

/* bottom ads */
#bottomads {
  display: none !important;
}

#taw {
  display: none !important;
}

/* footer */
/* #sfooter {
  display: none !important;
} */


  /* rabby */

  .x-rabby-alert-container {
    padding-top: 14px;
    padding-left: 16px;
    padding-right: 16px;
  }
  .x-rabby-alert {
    display: flex;
    padding: 8px;
    justify-content: center;
    align-items: center;
    gap: 4px;

    border-radius: 8px;
    background: rgba(255, 115, 107, 0.10);
  }

  .x-rabby-alert-icon {
    width: 14px;
    height: 14px;
  }
  .x-rabby-alert-content {
    color: #FF453A;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px; /* 128.571% */
  }

  .x-rabby-list-by-container {
    margin-top: -8px;
    padding-left: 16px;
    padding-right: 16px;
    padding-bottom: 8px;
  }
  .x-rabby-list-by {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .x-rabby-list-by-label {
    color: #3E495E;
    font-size: 14px;
    font-weight: 400;
    line-height: 18px;
  }
  .x-rabby-list-by-list {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .x-rabby-list-by-list-item {
    width: 12px;
    height: 12px;
    border-radius: 12px;
  }

  @media (prefers-color-scheme: dark) {
    .x-rabby-list-by-label {
      color: #D3D8E0;
    } 
  }
  `;

    document.head.appendChild($style);
  } catch (e) {
    console.error(e);
  }
};

const sleep = time => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, time);
  });
};

const injectListBy = async list => {
  try {
    const dappsInfo = await window.ethereum
      .request({
        method: 'rabby_getDappsInfo',
        params: [{ domains: list.map(item => item.hostname) }],
      })
      .catch(e => {
        console.error(e);
        return {};
      });
    list.forEach(item => {
      try {
        const $card = item.$card;
        const hostname = item.hostname;
        const collections = dappsInfo[hostname]?.collected_list;
        if (collections?.length) {
          const $listBy = document.createElement('div');
          $listBy.innerHTML = `
          <div class="x-rabby-list-by-container">
            <div class="x-rabby-list-by">
              <div class="x-rabby-list-by-label">Listed by:</div>
              <div class="x-rabby-list-by-list">
              </div>
            </div>
          </div>`;
          const $listByContainer = $listBy.querySelector(
            '.x-rabby-list-by-list',
          );
          collections.forEach(item => {
            const $img = document.createElement('img');
            $img.src = item.logo_url;
            $img.className = 'x-rabby-list-by-list-item';
            $listByContainer.appendChild($img);
          });

          $card.appendChild($listBy);
        }
      } catch (e) {
        console.error(e);
      }
    });
  } catch (e) {
    console.error(e);
  }
};

const injectScamAlert = async list => {
  try {
    list.forEach(async item => {
      try {
        const $card = item.$card;
        const { is_scam: isScam } = await window.ethereum
          .request({
            method: 'rabby_getOriginIsScam',
            params: [{ origin: item.origin, source: 'rabby' }],
          })
          .catch(e => {
            return {};
          });
        if (isScam) {
          const $scam = document.createElement('div');
          $scam.innerHTML = `
      <div class="x-rabby-alert-container">
        <div class="x-rabby-alert">
          <img className="x-rabby-alert-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='14' viewBox='0 0 15 14' fill='none'%3E%3Cg clip-path='url(%23clip0_38848_46944)'%3E%3Cpath d='M8.66771 1.63437C8.66771 1.69271 8.78438 1.80938 8.95938 2.10104C9.13438 2.39271 9.30938 2.68437 9.54271 3.15104C9.77604 3.61771 10.0677 4.02604 10.3594 4.55104C10.651 5.07604 11.001 5.60104 11.2927 6.12604C11.5844 6.65104 11.9344 7.23438 12.226 7.75938C12.5177 8.28437 12.8094 8.80938 13.101 9.21771C13.3344 9.68437 13.5677 10.0344 13.801 10.3844C14.0344 10.7344 14.0927 10.9094 14.2094 11.026C14.326 11.2594 14.4427 11.4927 14.4427 11.726C14.501 11.9594 14.4427 12.1344 14.3844 12.3677C14.326 12.601 14.2094 12.7177 14.0927 12.8344C13.9177 12.951 13.7427 13.0094 13.5094 13.0094H1.72604C1.37604 13.0094 1.08438 12.951 0.909375 12.8344C0.734375 12.7177 0.617708 12.5427 0.559375 12.3677C0.501042 12.1927 0.501042 11.9594 0.559375 11.7844C0.617708 11.551 0.676042 11.376 0.851042 11.1427C0.909375 11.026 1.02604 10.851 1.20104 10.501C1.37604 10.2094 1.60938 9.80104 1.90104 9.39271C2.19271 8.92604 2.48438 8.45937 2.77604 7.93437C3.06771 7.40937 3.41771 6.82604 3.76771 6.30104C4.11771 5.77604 4.40938 5.19271 4.70104 4.66771C4.99271 4.14271 5.28437 3.67604 5.51771 3.26771C5.75104 2.85937 5.98438 2.50937 6.15938 2.21771L6.45104 1.75104C6.56771 1.57604 6.74271 1.40104 6.97604 1.28438C7.20938 1.16771 7.38438 1.10938 7.61771 1.10938C7.85104 1.10938 8.02604 1.16771 8.25938 1.22604C8.37604 1.28437 8.55104 1.45937 8.66771 1.63437ZM8.31771 4.31771C8.31771 4.20104 8.31771 4.08437 8.25938 4.02604C8.20104 3.90937 8.14271 3.85104 8.08438 3.79271C8.02604 3.73438 7.90938 3.67604 7.79271 3.61771C7.67604 3.55937 7.55938 3.50104 7.44271 3.50104C7.20938 3.50104 7.03438 3.55938 6.85938 3.73438C6.68438 3.90937 6.56771 4.08437 6.56771 4.31771V7.93437C6.56771 8.16771 6.68438 8.34271 6.85938 8.51771C7.03438 8.69271 7.20938 8.75104 7.44271 8.75104C7.67604 8.75104 7.85104 8.69271 8.02604 8.51771C8.20104 8.34271 8.31771 8.16771 8.31771 7.93437V4.31771ZM7.44271 9.56771C7.20938 9.56771 6.97604 9.62604 6.85938 9.80104C6.74271 9.97604 6.62604 10.151 6.62604 10.3844C6.62604 10.6177 6.68438 10.851 6.85938 10.9677C7.03438 11.1427 7.20938 11.201 7.44271 11.201C7.67604 11.201 7.90938 11.1427 8.02604 10.9677C8.20104 10.7927 8.25938 10.6177 8.25938 10.3844C8.25938 10.151 8.20104 9.91771 8.02604 9.80104C7.90938 9.62604 7.67604 9.56771 7.44271 9.56771Z' fill='%23FF453A'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_38848_46944'%3E%3Crect width='14' height='14' fill='white' transform='translate(0.5)'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E"/>
          <div class="x-rabby-alert-content">
            The website has been flagged as scam by Rabby
          </div>
        </div>
      </div>
      `;
          $card.insertBefore($scam, $card.firstChild);
        }
      } catch (e) {
        console.error(e);
      }
    });
  } catch (e) {
    console.error(e);
  }
};

const injectScript = async () => {
  const $siteCardList = document.querySelectorAll(
    '.xpd:not([data-inject-rabby])',
  );

  const list = Array.from($siteCardList).map($card => {
    const $a = $card.querySelector('a');
    $card.setAttribute('data-inject-rabby', 'true');
    try {
      const url = $a.href ? new URL($a.href) : null;
      return {
        $card: $card,
        hostname: url?.hostname,
        origin: url.origin,
      };
    } catch (e) {
      return {
        $card: $card,
        hostname: '',
        origin: '',
      };
    }
  });

  injectListBy(list);
  injectScamAlert(list);
};

const observeSite = () => {
  const targetNode = document.querySelector('#main');

  const config = {
    childList: true,
    subtree: true,
  };

  const observer = new MutationObserver(mutationsList => {
    setTimeout(() => {
      injectScript();
    }, 50);
  });

  observer.observe(targetNode, config);
};

const checkIsGoogle = () => {
  const googleRegex =
    /^(https?:\/\/)?([a-z0-9-]+\.)*google\.(com(\.[a-z]{2,3})?|org|net|co\.[a-z]{2}|[a-z]{2})(\/|$)/i;
  return (
    googleRegex.test(window.location.origin) &&
    window.location.pathname === '/search'
  );
};
export const hackGoogle = () => {
  if (checkIsGoogle()) {
    injectCss();
  }
  domReadyCall(() => {
    if (checkIsGoogle()) {
      injectCss();
      setTimeout(() => {
        injectScript();
      }, 500);
      observeSite();
    }
  });
};
