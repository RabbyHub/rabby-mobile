// import { View } from 'react-native';
import { useOpenUrlView, useOpenDappView } from '../../hooks/useDappView';
import SheetDappWebView from './SheetDappWebView';
import SheetGeneralWebView from './SheetGeneralWebView';

export function OpenedDappWebViewStub() {
  const { openedDapps, hideActiveDapp } = useOpenDappView();

  return (
    <>
      {openedDapps.map((dappInfo, idx) => {
        return (
          <SheetDappWebView
            key={`${dappInfo.origin}-${dappInfo.chainId}-${idx}`}
            dapp={dappInfo}
            onHideModal={() => {
              hideActiveDapp();
            }}
          />
        );
      })}
    </>
  );
}

export function OpenedWebViewsStub() {
  const { openedNonDappOrigin } = useOpenUrlView();

  if (!openedNonDappOrigin) return null;

  return (
    <>
      {[openedNonDappOrigin].map((url, idx) => {
        return <SheetGeneralWebView key={`${url}-${idx}`} url={url} />;
      })}
    </>
  );
}
