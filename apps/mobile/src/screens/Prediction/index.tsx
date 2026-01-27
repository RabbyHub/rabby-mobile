import React from 'react';

import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useTranslation } from 'react-i18next';

const PREDICTION_LIST = INNER_DAPP_LIST.PREDICTION;
const DEFAULT_PREDICTION_ID = PREDICTION_LIST[0]?.id ?? 'polymarket';

export default function PredictionScreen() {
  const { t } = useTranslation();
  return (
    <InnerDappWebViewScreen
      list={PREDICTION_LIST}
      activeId={DEFAULT_PREDICTION_ID}
      onSelectDapp={() => {}}
      renderWebView={false}
      dappSelectTitle={t('page.predict.dappSelect.title')}
    />
  );
}
