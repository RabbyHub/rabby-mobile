import React from 'react';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import type { Chain } from '@/constant/chains';
import { formatTokenAmount } from '@/utils/number';
import { Col, Row, Table } from './components/Table';
import useCommonStyle from '../../hooks/useCommonStyle';
import { Text } from '@/components/Typography';

const DeployContract = ({
  value,
  chain,
}: {
  value?: string | number;
  chain: Chain;
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const payAmount = new BigNumber(value || 0);

  return (
    <Table>
      <Col>
        <Row isTitle>
          <Text style={commonStyle.rowTitleText}>
            {t('page.signTx.deployContract.descriptionTitle')}
          </Text>
        </Row>
        <Row>
          <Text style={commonStyle.primaryText}>
            {t('page.signTx.deployContract.description')}
          </Text>
        </Row>
      </Col>
      {payAmount.gt(0) && (
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.contractCall.payNativeToken', {
                symbol: chain.nativeTokenSymbol,
              })}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
              {formatTokenAmount(payAmount.div(1e18).toFixed())}{' '}
              {chain.nativeTokenSymbol}
            </Text>
          </Row>
        </Col>
      )}
    </Table>
  );
};

export default DeployContract;
