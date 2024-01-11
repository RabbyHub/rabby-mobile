import { View, Text } from 'react-native';
import React, { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useTranslation } from 'react-i18next';
import { Chain } from '@debank/common';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ParsedActionData, SendRequireData } from './utils';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import LogoWithText from './components/LogoWithText';
// import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';

const Send = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['send'];
  requireData: SendRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { init } = useApprovalSecurityEngine();
  const { t } = useTranslation();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  useEffect(() => {
    init();
  }, []);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.send.sendToken')}</Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.token.logo_url}
              text={
                <>
                  <Text>{formatTokenAmount(actionData.token.amount)} </Text>
                  <Values.TokenSymbol token={actionData.token} />
                </>
              }
              logoRadius={16}
            />
            <View className="desc-list">
              <Text>
                ≈
                {formatUsdValue(
                  new BigNumber(actionData.token.price)
                    .times(actionData.token.amount)
                    .toFixed(),
                )}
              </Text>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.send.sendTo')}</Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.to} chain={chain} />
              <View className="desc-list">
                {/* <View>
                  <Values.AddressMemo address={actionData.to} />
                </View> */}
                {requireData.name && <Text>{requireData.name}</Text>}
                <SecurityListItem
                  engineResult={engineResultMap['1016']}
                  dangerText={t('page.signTx.send.receiverIsTokenAddress')}
                  id="1016"
                />
                <SecurityListItem
                  engineResult={engineResultMap['1019']}
                  dangerText={t('page.signTx.send.contractNotOnThisChain')}
                  id="1019"
                />
                {requireData.cex && (
                  <>
                    <View>
                      <LogoWithText
                        logo={requireData.cex.logo}
                        text={requireData.cex.name}
                        logoSize={14}
                        textStyle={{
                          fontSize: '13px',
                          lineHeight: '15px',
                          color: '#4B4D59',
                          fontWeight: 'normal',
                        }}
                      />
                    </View>
                    <SecurityListItem
                      engineResult={engineResultMap['1021']}
                      dangerText={t('page.signTx.send.notTopupAddress')}
                      id="1021"
                    />
                    <SecurityListItem
                      engineResult={engineResultMap['1020']}
                      dangerText={t('page.signTx.send.tokenNotSupport', [
                        ellipsisTokenSymbol(getTokenSymbol(actionData.token)),
                      ])}
                      id="1020"
                    />
                  </>
                )}
                <SecurityListItem
                  engineResult={engineResultMap['1018']}
                  warningText={<Values.Transacted value={false} />}
                  id="1018"
                />
                <SecurityListItem
                  engineResult={engineResultMap['1033']}
                  safeText={t('page.signTx.send.onMyWhitelist')}
                  id="1033"
                />
                <View>
                  {/* <ViewMore
                    type="receiver"
                    data={{
                      token: actionData.token,
                      address: actionData.to,
                      chain,
                      eoa: requireData.eoa,
                      cex: requireData.cex,
                      contract: requireData.contract,
                      usd_value: requireData.usd_value,
                      hasTransfer: requireData.hasTransfer,
                      isTokenContract: requireData.isTokenContract,
                      name: requireData.name,
                      onTransferWhitelist: requireData.onTransferWhitelist,
                    }}
                  /> */}
                </View>
              </View>
            </View>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default Send;
