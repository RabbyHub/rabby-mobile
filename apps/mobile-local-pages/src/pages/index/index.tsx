import { useState } from 'react';

import '../../imports';
import './index.less';

import { resolvePublicResourcePath } from '../../utils/webview-resources';
import { getInjectedObject } from '../../utils/webview-runtime';
import { usePageI18n, usePageThemeMode } from '../../hooks/webview-runtime';
import { bootstrapApp } from '../../utils/page-store';

function App() {
  const [count, setCount] = useState(0);
  const { themeMode } = usePageThemeMode();
  const { i18nTexts } = usePageI18n();

  return (
    <div className="w-[100vw]">
      <div className="flex items-center justify-center mb-4">
        <a href="https://rabby.io" target="_blank">
          <img
            src={resolvePublicResourcePath('/rabby-logo.svg')}
            className="logo"
            alt="Rabby logo"
          />
        </a>
      </div>
      <h1>{i18nTexts['page.devUIBuiltInPages.builtInPageTitle']}</h1>
      <div className="py-[2em]">
        <button
          className="!bg-brand-default text-neutral-title-2"
          onClick={() => setCount(count => count + 1)}>
          count is {count}
        </button>
        <p className="text-neutral-title-1 mt-[16px] gap-[12px] flex flex-row w-full justify-center">
          <span className="rounded-[4px] inline-block border-[1px] border-neutral-line py-[4px] px-[6px]">
            themeMode: {themeMode}
          </span>
          <span className="rounded-[4px] inline-block border-[1px] border-neutral-line py-[4px] px-[6px]">
            platform: {getInjectedObject().platform}
          </span>
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Rabby and React logos to learn more
      </p>
    </div>
  );
}

bootstrapApp(App);
