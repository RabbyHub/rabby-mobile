import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ContractCallRequireData, ParsedActionData } from './utils';
import { formatTokenAmount } from '@/utils/number';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { ProtocolListItem } from './components/ProtocolListItem';
import { SecurityListItem } from './components/SecurityListItem';
import IconQuestionMark from '@/assets/icons/sign/tx/question-mark.svg';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';

import useCommonStyle from '../../hooks/useCommonStyle';
import DescItem from './components/DescItem';

const { isSameAddress } = addressUtils;

const ContractCall = ({
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['contractCall'];
  requireData: ContractCallRequireData;
  chain: Chain;
  raw: Record<string, string | number>;
  engineResults: Result[];
  onChange(tx: Record<string, any>): void;
}) => {
  const { userData, init } = useApprovalSecurityEngine();
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const { contractWhitelist } = userData;

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain.serverId &&
        isSameAddress(item.address, requireData.id),
    );
  }, [contractWhitelist, requireData, chain]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.interactContract')}
            </Text>
          </Row>
          <Row>
            <Values.Address address={requireData.id} chain={chain} />

            {requireData.protocol && (
              <DescItem>
                <ProtocolListItem protocol={requireData.protocol} />
              </DescItem>
            )}
            <DescItem>
              <Values.Interacted
                value={requireData.hasInteraction}
                textStyle={commonStyle.secondaryText}
              />
            </DescItem>

            {isInWhitelist && (
              <DescItem>
                <Text>{t('page.signTx.markAsTrust')}</Text>
              </DescItem>
            )}

            <SecurityListItem
              id="1135"
              engineResult={engineResultMap['1135']}
              forbiddenText={t('page.signTx.markAsBlock')}
            />

            <SecurityListItem
              id="1137"
              engineResult={engineResultMap['1137']}
              warningText={t('page.signTx.markAsBlock')}
            />
            <DescItem>
              <ViewMore
                type="contract"
                data={{
                  hasInteraction: requireData.hasInteraction,
                  bornAt: requireData.bornAt,
                  protocol: requireData.protocol,
                  rank: requireData.rank,
                  address: requireData.id,
                  chain,
                }}
              />
            </DescItem>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.contractCall.operation')}
            </Text>
          </Row>
          <Row>
            <View className="relative flex items-center flex-row">
              <Text>{requireData.call.func || '-'}</Text>
              <IconQuestionMark className="w-[12] ml-[6]" />
            </View>
          </Row>
        </Col>
        {new BigNumber(requireData.payNativeTokenAmount).gt(0) && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.contractCall.payNativeToken', {
                  symbol: requireData.nativeTokenSymbol,
                })}
              </Text>
            </Row>
            {
              <Row>
                <Text>
                  {formatTokenAmount(
                    new BigNumber(requireData.payNativeTokenAmount)
                      .div(1e18)
                      .toFixed(),
                  )}{' '}
                  {requireData.nativeTokenSymbol}
                </Text>
              </Row>
            }
          </Col>
        )}
      </Table>
    </View>
  );
};

export default ContractCall;
