import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ApproveTokenRequireData,
  ParsedTypedDataActionData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import { StyleSheet, Text, View } from 'react-native';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import useCommonStyle from '../../hooks/useCommonStyle';
import { TokenAmountItem } from '../Actions/components/TokenAmountItem';
import { SubTable, SubCol, SubRow } from '../Actions/components/SubTable';

const Permit = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedTypedDataActionData['permit'];
  requireData: ApproveTokenRequireData;
  chain?: Chain;
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

  const tokenBalance = useMemo(() => {
    return new BigNumber(requireData.token.raw_amount || '0')
      .div(10 ** requireData.token.decimals)
      .toFixed();
  }, [requireData]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permitTokenRef = React.useRef(null);
  const permitAddressRef = React.useRef(null);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveToken')}
            </Text>
          </Row>
          <Row>
            <View ref={permitTokenRef}>
              <TokenAmountItem
                amount={actionData.token.amount}
                logoUrl={actionData.token.logo_url}
                balance={tokenBalance}
              />
            </View>
          </Row>
        </Col>

        <SubTable target={permitTokenRef}>
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
              <Values.TokenAmount value={tokenBalance} />
              <Text style={commonStyle.subRowText}>
                {ellipsisTokenSymbol(getTokenSymbol(actionData.token))}
              </Text>
            </SubRow>
          </SubCol>
        </SubTable>

        <Col>
          <Row isTitle tip={t('page.signTypedData.permit2.sigExpireTimeTip')}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTypedData.permit2.sigExpireTime')}
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
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveTo')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="spender"
              data={{
                ...requireData,
                spender: actionData.spender,
                chain,
              }}>
              <View ref={permitAddressRef}>
                <Values.Address address={actionData.spender} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>

        <SubTable target={permitAddressRef}>
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
            id="1077"
            engineResult={engineResultMap['1077']}
            dangerText={t('page.signTx.tokenApprove.eoaAddress')}
            title={t('page.signTx.addressTypeTitle')}
          />

          <SecurityListItem
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}
            id="1148"
            engineResult={engineResultMap['1148']}
            warningText={'$0'}
            title={t('page.signTx.trustValueTitle')}
          />

          <SecurityListItem
            id="1079"
            engineResult={engineResultMap['1079']}
            warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
              value: '3',
            })}
            title={t('page.signTx.deployTimeTitle')}
          />

          <SecurityListItem
            id="1106"
            engineResult={engineResultMap['1106']}
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

export default Permit;
