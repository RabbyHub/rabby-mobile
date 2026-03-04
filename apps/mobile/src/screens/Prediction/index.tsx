import React from 'react';

import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { useTranslation } from 'react-i18next';
import { matomoRequestEvent } from '@/utils/analytics';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

const PREDICTION_LIST = INNER_DAPP_LIST.PREDICTION;
const DEFAULT_PREDICTION_ID = PREDICTION_LIST[0]?.id ?? 'polymarket';

export default function PredictionScreen() {
  const { t } = useTranslation();
  const { prediction, setPrediction } = useInnerDappSelection();

  return (
    <InnerDappWebViewScreen
      list={PREDICTION_LIST}
      activeId={prediction || DEFAULT_PREDICTION_ID}
      onSelectDapp={item => {
        setPrediction(item.id);
        if (item.url) {
          matomoRequestEvent({
            category: 'Websites Usage',
            action: 'Website_Visit_Website Select Provider',
            label: safeGetOrigin(item.url) || item.url,
          });
        }
      }}
      renderWebView={false}
      dappSelectTitle={t('page.predict.dappSelect.title')}
    />
  );
}
