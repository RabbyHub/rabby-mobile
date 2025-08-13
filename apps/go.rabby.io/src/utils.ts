// import queryString from 'query-string'

export function formatRabbySchemaUrl(rabbyGoEnv: string, hrefString: string) {
  const appSchema = (() => {
    switch (rabbyGoEnv) {
      case 'mobile-debug':
        return 'rabbygo-debug:';
      case 'mobile-regression':
        return 'rabbygo-regression:';
      case 'mobile-release':
        return 'rabbygo:';
    }
  })();

  // const qsObj = queryString.parse(window.location.search);
  // const rabbySchemaUrl = window.location.href.replace(/https?:\/\//, 'rabby://');

  const rabbySchemaUrl = hrefString.replace(/^https?:\/\//, `${appSchema}//`);
  return rabbySchemaUrl;
}
