import React from 'react';

import { INNER_DAPP_LIST } from '@/components2024/DappFrameAccountHeader';
import { InnerDappWebViewScreen } from '@/components2024/InnerDappWebViewScreen';
import { useInnerDappSelection } from '@/hooks/useInnerDappSelection';
import { useTranslation } from 'react-i18next';

const PREDICTION_LIST = INNER_DAPP_LIST.PREDICTION;
const DEFAULT_PREDICTION_ID = PREDICTION_LIST[0]?.id ?? 'polymarket';

export default function PredictionScreen() {
  const { t } = useTranslation();
  const { prediction, setPrediction } = useInnerDappSelection();

  return (
    <InnerDappWebViewScreen
      list={PREDICTION_LIST}
      activeId={prediction || DEFAULT_PREDICTION_ID}
      onSelectDapp={item => setPrediction(item.id)}
      renderWebView={false}
      dappSelectTitle={t('page.predict.dappSelect.title')}
    />
  );
}
