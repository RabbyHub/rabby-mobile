import React, { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  BatchApproveTokenRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { StyleSheet, Text, View } from 'react-native';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import useCommonStyle from '../../hooks/useCommonStyle';
import { TokenAmountItem } from '../Actions/components/TokenAmountItem';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';

const Permit2 = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedTypedDataActionData['batchPermit2'];
  requireData: BatchApproveTokenRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const { init } = useApprovalSecurityEngine();
  const commonStyle = useCommonStyle();

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
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batchPermit2AddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        {actionData.token_list.map((token, index) => (
          <>
            <Col>
              <Row isTitle itemsCenter>
                <Text style={commonStyle.rowTitleText}>
                  {index === 0
                    ? t('page.signTx.tokenApprove.approveToken')
                    : ''}
                </Text>
              </Row>
              <Row
                style={StyleSheet.flatten({
                  overflow: 'hidden',
                  paddingLeft: 6,
                })}>
                <TokenAmountItem
                  amount={token.amount}
                  logoUrl={token.logo_url}
                  balance={tokenBalanceMap[token.id]}
                />
              </Row>
            </Col>
            <SubTable>
              <SubCol>
                <SubRow isTitle>
                  <Text style={commonStyle.subRowTitleText}>
                    {t('page.signTx.tokenApprove.myBalance')}
                  </Text>
                </SubRow>
                <SubRow
                  style={StyleSheet.flatten({
                    flexDirection: 'row',
                    gap: 4,
                  })}>
                  <Values.TokenAmount
                    style={commonStyle.subRowText}
                    value={tokenBalanceMap[token.id]}
                  />
                  <Text style={commonStyle.subRowText}>
                    {ellipsisTokenSymbol(getTokenSymbol(token))}
                  </Text>
                </SubRow>
              </SubCol>
            </SubTable>
          </>
        ))}

        <Col>
          <Row isTitle tip={t('page.signTypedData.permit2.sigExpireTimeTip')}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.permit2.sigExpireTime')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
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
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.permit2.approvalExpiretime')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
              {actionData.expire_at ? (
                <Values.TimeSpanFuture to={actionData.expire_at} />
              ) : (
                '-'
              )}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row isTitle itemsCenter>
            <ViewMore
              type="spender"
              data={{
                ...requireData,
                spender: actionData.spender,
                chain,
              }}>
              <Text
                ref={batchPermit2AddressRef}
                style={commonStyle.rowTitleText}>
                {t('page.signTx.tokenApprove.approveTo')}
              </Text>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={batchPermit2AddressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.protocol')}
              </Text>
            </SubRow>
            <SubRow>
              <ProtocolListItem
                style={commonStyle.subRowText}
                protocol={requireData.protocol}
              />
            </SubRow>
          </SubCol>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.hasInteraction')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.Interacted value={requireData.hasInteraction} />
            </SubRow>
          </SubCol>

          <SecurityListItem
            id="1109"
            engineResult={engineResultMap['1109']}
            dangerText={t('page.signTx.tokenApprove.eoaAddress')}
            title={t('page.signTx.addressTypeTitle')}
          />

          <SecurityListItem
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}
            id="1145"
            engineResult={engineResultMap['1145']}
            warningText={'$0'}
            title={t('page.signTx.trustValueTitle')}
          />

          <SecurityListItem
            id="1111"
            engineResult={engineResultMap['1111']}
            warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
              value: '3',
            })}
            title={t('page.signTx.deployTimeTitle')}
          />

          <SecurityListItem
            id="1113"
            engineResult={engineResultMap['1113']}
            title={t('page.signTx.tokenApprove.flagByRabby')}
            dangerText={t('page.signTx.yes')}
          />

          <SecurityListItem
            id="1134"
            engineResult={engineResultMap['1134']}
            forbiddenText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />

          <SecurityListItem
            id="1136"
            engineResult={engineResultMap['1136']}
            warningText={t('page.signTx.markAsBlock')}
            title={t('page.signTx.myMark')}
          />

          <SecurityListItem
            id="1133"
            engineResult={engineResultMap['1133']}
            safeText={t('page.signTx.markAsTrust')}
            title={t('page.signTx.myMark')}
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default Permit2;
