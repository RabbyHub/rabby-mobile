import React, { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { BatchApproveTokenRequireData, TypedDataActionData } from './utils';
import { Table, Col, Row } from '../Actions/components/Table';
import LogoWithText from '../Actions/components/LogoWithText';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import { Chain } from '@debank/common';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { Text, View } from 'react-native';
import { formatAmount } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import DescItem from '../Actions/components/DescItem';

const Permit2 = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: TypedDataActionData['batchPermit2'];
  requireData: BatchApproveTokenRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const { init } = useApprovalSecurityEngine();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  const tokenBalanceMap: Record<string, string> = useMemo(() => {
    return requireData.tokens.reduce((res, token) => {
      return {
        ...res,
        [token.id]: new BigNumber(token.raw_amount || '0')
          .div(10 ** token.decimals)
          .toFixed(),
      };
    }, {});
  }, [requireData]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.tokenApprove.approveToken')}</Text>
          </Row>
          <View className="flex-1 overflow-hidden">
            {actionData.token_list.map(token => (
              <Row key={token.id}>
                <LogoWithText
                  logo={token.logo_url}
                  textNode={
                    <View className="overflow-hidden overflow-ellipsis flex flex-1">
                      <Values.TokenAmount value={token.amount} />
                      <View className="ml-2">
                        <Values.TokenSymbol token={token} />
                      </View>
                    </View>
                  }
                  logoRadius={16}
                />
                <View className="desc-list">
                  <DescItem>
                    <View>
                      <Text>{t('page.signTx.tokenApprove.myBalance')} </Text>
                      <Text>{formatAmount(tokenBalanceMap[token.id])} </Text>
                      <Text>{ellipsisTokenSymbol(getTokenSymbol(token))}</Text>
                    </View>
                  </DescItem>
                </View>
              </Row>
            ))}
          </View>
        </Col>
        <Col>
          <Row isTitle tip={t('page.signTypedData.permit2.sigExpireTimeTip')}>
            <Text>{t('page.signTypedData.permit2.sigExpireTime')}</Text>
          </Row>
          <Row>
            <Text>
              {actionData.sig_expire_at ? (
                <Values.TimeSpanFuture to={actionData.sig_expire_at} />
              ) : (
                '-'
              )}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTypedData.permit2.approvalExpiretime')}</Text>
          </Row>
          <Row>
            <Text>
              {actionData.expire_at ? (
                <Values.TimeSpanFuture to={actionData.expire_at} />
              ) : (
                '-'
              )}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.tokenApprove.approveTo')}</Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.spender} chain={chain} />
            </View>
            <View className="desc-list">
              <DescItem>
                <ProtocolListItem protocol={requireData.protocol} />
              </DescItem>

              <SecurityListItem
                id="1109"
                engineResult={engineResultMap['1109']}
                dangerText="EOA address"
              />

              <SecurityListItem
                id="1112"
                engineResult={engineResultMap['1112']}
                warningText={<Values.Interacted value={false} />}
                defaultText={
                  <Values.Interacted value={requireData.hasInteraction} />
                }
              />

              <SecurityListItem
                id="1110"
                engineResult={engineResultMap['1110']}
                dangerText={t('page.signTx.tokenApprove.trustValueLessThan', {
                  value: '$10,000',
                })}
                warningText={t('page.signTx.tokenApprove.trustValueLessThan', {
                  value: '$100,000',
                })}
              />

              <SecurityListItem
                id="1111"
                engineResult={engineResultMap['1111']}
                warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
                  value: '3',
                })}
              />

              <SecurityListItem
                id="1113"
                engineResult={engineResultMap['1113']}
                dangerText={t('page.signTx.tokenApprove.flagByRabby')}
              />

              <SecurityListItem
                id="1134"
                engineResult={engineResultMap['1134']}
                forbiddenText={t('page.signTx.markAsBlock')}
              />

              <SecurityListItem
                id="1136"
                engineResult={engineResultMap['1136']}
                warningText={t('page.signTx.markAsBlock')}
              />

              <SecurityListItem
                id="1133"
                engineResult={engineResultMap['1133']}
                safeText={t('page.signTx.markAsTrust')}
              />

              <ViewMore
                type="spender"
                data={{
                  ...requireData,
                  spender: actionData.spender,
                  chain,
                }}
              />
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default Permit2;
