// import queryString from 'query-string'

export function formatRabbySchemeUrl(rabbyGoEnv: string, hrefString: string) {
  const appSchema = (() => {
    switch (rabbyGoEnv) {
      case 'mobile-debug':
        return 'rabbygo-debug:';
      case 'mobile-regression':
        return 'rabbygo-regression:';
      case 'mobile-production':
      case 'mobile':
        return 'rabbygo:';
    }
  })();

  // const qsObj = queryString.parse(window.location.search);
  // const rabbySchemeUrl = window.location.href.replace(/https?:\/\//, 'rabby://');

  const rabbySchemeUrl = hrefString.replace(/^https?:\/\//, `${appSchema}//`);
  return rabbySchemeUrl;
}
