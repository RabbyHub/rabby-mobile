import { View, Text, StyleSheet } from 'react-native';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ParsedActionData, SendRequireData } from '@rabby-wallet/rabby-action';
import { formatTokenAmount } from '@/utils/number';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import LogoWithText from './components/LogoWithText';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import { INTERNAL_REQUEST_SESSION } from '@/constant';

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
  const commonStyle = useCommonStyle();

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

  const isLabelAddress =
    requireData.name && Object.values(ALIAS_ADDRESS).includes(requireData.name);

  const sendContractRef = React.useRef<View>(null);
  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.send.sendToken')}
            </Text>
          </Row>
          <Row>
            <LogoWithText
              logo={actionData.token.logo_url}
              text={
                <View style={commonStyle.rowFlexCenterItem}>
                  <Text style={commonStyle.primaryText}>
                    {formatTokenAmount(actionData.token.amount)}{' '}
                  </Text>
                  <Values.TokenSymbol
                    token={actionData.token}
                    style={StyleSheet.flatten([
                      commonStyle.primaryText,
                      commonStyle.clickableTokenText,
                    ])}
                  />
                </View>
              }
              logoRadius={16}
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.send.sendTo')}
            </Text>
          </Row>
          <Row>
            <View>
              <ViewMore
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
                  hasReceiverMnemonicInWallet:
                    requireData.hasReceiverMnemonicInWallet,
                  hasReceiverPrivateKeyInWallet:
                    requireData.hasReceiverPrivateKeyInWallet,
                }}>
                <View ref={sendContractRef}>
                  <Values.Address address={actionData.to} chain={chain} />
                </View>
              </ViewMore>
            </View>
          </Row>
        </Col>
        <SubTable target={sendContractRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.addressNote')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.AddressMemo
                textStyle={commonStyle.subRowText}
                address={actionData.to}
              />
            </SubRow>
          </SubCol>
          {requireData.protocol && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.protocol')}
                </Text>
              </SubRow>
              <SubRow>
                <Values.Protocol
                  value={requireData.protocol}
                  textStyle={commonStyle.detailPrimaryText}
                />
              </SubRow>
            </SubCol>
          )}
          {!!requireData.contract && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.addressTypeTitle')}
                </Text>
              </SubRow>
              <SubRow>
                <Text style={commonStyle.subRowText}>
                  {t('page.signTx.contract')}
                </Text>
              </SubRow>
            </SubCol>
          )}
          {!!requireData.name && (
            <SubCol nested={!isLabelAddress}>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {isLabelAddress ? t('page.signTx.label') : ' '}
                </Text>
              </SubRow>
              <SubRow>
                {isLabelAddress ? (
                  <LogoWithText
                    text={requireData.name}
                    logo={INTERNAL_REQUEST_SESSION.icon}
                    textStyle={commonStyle.subRowNestedText}
                  />
                ) : (
                  <Text style={commonStyle.subRowNestedText}>
                    {requireData.name.replace(/^Token: /, 'Token ') +
                      ' contract address'}
                  </Text>
                )}
              </SubRow>
            </SubCol>
          )}
          <SecurityListItem
            engineResult={engineResultMap['1019']}
            dangerText={t('page.signTx.send.contractNotOnThisChain')}
            noTitle
            id="1019"
          />
          <SecurityListItem
            title={t('page.signTx.addressSource')}
            engineResult={engineResultMap['1142']}
            safeText={
              requireData.hasReceiverMnemonicInWallet
                ? t('page.signTx.send.fromMySeedPhrase')
                : t('page.signTx.send.fromMyPrivateKey')
            }
            id="1142"
          />
          <SecurityListItem
            engineResult={engineResultMap['1016']}
            dangerText={t('page.signTx.yes')}
            title={t('page.signTx.send.receiverIsTokenAddress')}
            id="1016"
          />
          {requireData.cex && (
            <>
              <SubCol>
                <SubRow isTitle>
                  <Text style={commonStyle.subRowTitleText}>
                    {t('page.signTx.send.cexAddress')}
                  </Text>
                </SubRow>
                <SubRow>
                  <LogoWithText
                    logo={requireData.cex.logo}
                    text={requireData.cex.name}
                    textStyle={commonStyle.subRowText}
                  />
                </SubRow>
              </SubCol>
              <SecurityListItem
                noTitle
                engineResult={engineResultMap['1021']}
                dangerText={t('page.signTx.send.notTopupAddress')}
                id="1021"
              />
              <SecurityListItem
                noTitle
                engineResult={engineResultMap['1020']}
                // @ts-ignore
                dangerText={t('page.signTx.send.tokenNotSupport', [
                  ellipsisTokenSymbol(getTokenSymbol(actionData.token)),
                ])}
                id="1020"
              />
            </>
          )}
          <SecurityListItem
            title={t('page.signTx.transacted')}
            engineResult={engineResultMap['1018']}
            warningText={<Values.Transacted value={false} />}
            id="1018"
          />
          <SecurityListItem
            title={t('page.signTx.tokenApprove.flagByRabby')}
            engineResult={engineResultMap['1143']}
            dangerText={t('page.signTx.send.scamAddress')}
            id="1143"
          />
          <SecurityListItem
            title={t('page.signTx.send.whitelistTitle')}
            engineResult={engineResultMap['1033']}
            safeText={t('page.signTx.send.onMyWhitelist')}
            id="1033"
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default Send;
