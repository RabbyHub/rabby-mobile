import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ApproveTokenRequireData, TypedDataActionData } from './utils';
import { Table, Col, Row } from '../Actions/components/Table';
import LogoWithText from '../Actions/components/LogoWithText';
import * as Values from '../Actions/components/Values';
import ViewMore from '../Actions/components/ViewMore';
import { SecurityListItem } from '../Actions/components/SecurityListItem';
import { ProtocolListItem } from '../Actions/components/ProtocolListItem';
import { Text, View } from 'react-native';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import { formatAmount } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { Chain } from '@/constant/chains';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';

const Permit2 = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: TypedDataActionData['permit2'];
  requireData: ApproveTokenRequireData;
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

  const tokenBalance = useMemo(() => {
    return new BigNumber(requireData.token.raw_amount || '0')
      .div(10 ** requireData.token.decimals)
      .toFixed();
  }, [requireData]);

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
              {t('page.signTx.tokenApprove.approveToken')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.token.logo_url}
              text={
                <View
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'row',
                  }}>
                  <Values.TokenAmount
                    value={actionData.token.amount}
                    style={commonStyle.primaryText}
                  />
                  <Values.TokenSymbol
                    token={requireData.token}
                    style={{
                      marginLeft: 2,
                      ...commonStyle.primaryText,
                    }}
                  />
                </View>
              }
              logoRadius={16}
              textStyle={{
                flex: 1,
              }}
            />
            <View>
              <DescItem>
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text style={commonStyle.secondaryText}>
                    {t('page.signTx.tokenApprove.myBalance')}{' '}
                  </Text>
                  <Text style={commonStyle.secondaryText}>
                    {formatAmount(tokenBalance)}{' '}
                  </Text>
                  <Text style={commonStyle.secondaryText}>
                    {ellipsisTokenSymbol(getTokenSymbol(actionData.token))}
                  </Text>
                </View>
              </DescItem>
            </View>
          </Row>
        </Col>
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
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.tokenApprove.approveTo')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.spender} chain={chain} />
            </View>
            <View className="desc-list">
              {requireData.protocol && (
                <DescItem>
                  <ProtocolListItem
                    protocol={requireData.protocol}
                    style={commonStyle.secondaryText}
                  />
                </DescItem>
              )}

              <SecurityListItem
                id="1071"
                engineResult={engineResultMap['1071']}
                dangerText="EOA address"
              />

              <SecurityListItem
                id="1074"
                engineResult={engineResultMap['1074']}
                warningText={
                  <Values.Interacted
                    value={false}
                    textStyle={commonStyle.secondaryText}
                  />
                }
                defaultText={
                  <Values.Interacted
                    value={requireData.hasInteraction}
                    textStyle={commonStyle.secondaryText}
                  />
                }
              />

              <SecurityListItem
                id="1072"
                engineResult={engineResultMap['1072']}
                dangerText={t('page.signTx.tokenApprove.trustValueLessThan', {
                  value: '$10,000',
                })}
                warningText={t('page.signTx.tokenApprove.trustValueLessThan', {
                  value: '$100,000',
                })}
              />

              <SecurityListItem
                id="1073"
                engineResult={engineResultMap['1073']}
                warningText={t('page.signTx.tokenApprove.deployTimeLessThan', {
                  value: '3',
                })}
              />

              <SecurityListItem
                id="1075"
                engineResult={engineResultMap['1075']}
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

              <DescItem>
                <ViewMore
                  type="spender"
                  data={{
                    ...requireData,
                    spender: actionData.spender,
                    chain,
                  }}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default Permit2;
