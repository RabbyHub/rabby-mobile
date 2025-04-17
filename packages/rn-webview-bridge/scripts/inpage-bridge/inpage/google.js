const domReadyCall = callback => {
  if (document.readyState === 'loading') {
    const domContentLoadedHandler = () => {
      callback();
      document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    };
    document.addEventListener('DOMContentLoaded', domContentLoadedHandler);
  } else {
    callback();
  }
};

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
  const $style = document.createElement('style');

  $style.innerHTML = `
/* header */
.Fh5muf {
  display: none !important;
}
  #rso {
  padding-top: 20px;
  }

/* tab bar*/
.gDIH3 {
  display: none !important;
}

/* search suggest */
#taw {
  display: none !important;
}

/* bottom ads */
#bottomads {
  display: none !important;
}

/* footer */
/* #sfooter {
  display: none !important;
} */

  `;

  document.head.appendChild($style);
};

const injectScript = () => {
  const $siteCardList = document.querySelectorAll(
    '.xpd:not([data-inject-rabby])',
  );
  $siteCardList.forEach($card => {
    try {
      const $a = $card.querySelector('a');
      const url = new URL($a.href);
      const origin = url.origin;

      // todo request api

      const $scam = document.createElement('div');
      $scam.innerHTML = `helle world`;
      $card.insertBefore($scam, $card.firstChild);

      const $listBy = document.createElement('div');
      $listBy.innerHTML = `list by`;
      $card.appendChild($listBy);

      $card.setAttribute('data-inject-rabby', 'true');
    } catch (e) {
      console.error(e);
    }
  });
};

const observeSite = () => {
  const targetNode = document.querySelector('#rso');

  const config = {
    childList: true,
  };

  const observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        injectScript();
      }
    }
  });

  observer.observe(targetNode, config);
};

export const hackGoogle = () => {
  domReadyCall(() => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    if (
      ['https://www.google.com', 'https://google.com'].includes(origin) &
      (path === '/search')
    ) {
      injectCss();
      injectScript();
      observeSite();
    }
  });
};
