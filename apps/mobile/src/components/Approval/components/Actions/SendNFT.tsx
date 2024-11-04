import React, { useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ParsedActionData,
  SendNFTRequireData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from './components/Table';
import LogoWithText from './components/LogoWithText';
import NFTWithName from './components/NFTWithName';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { useApprovalSecurityEngine } from '../../hooks/useApprovalSecurityEngine';
import useCommonStyle from '../../hooks/useCommonStyle';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { INTERNAL_REQUEST_SESSION } from '@/constant';

const SendNFT = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedActionData['sendNFT'];
  requireData: SendNFTRequireData;
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

  const sendNftRef = React.useRef(null);
  const sendNftAddressRef = React.useRef(null);
  const isLabelAddress =
    requireData.name && Object.values(ALIAS_ADDRESS).includes(requireData.name);

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.sendNFT.title')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="nft"
              data={{
                nft: actionData.nft,
                chain,
              }}>
              <View ref={sendNftRef}>
                <NFTWithName
                  textStyle={commonStyle.primaryText}
                  nft={actionData?.nft}
                />
              </View>
            </ViewMore>
            <SubTable target={sendNftRef}>
              {actionData?.nft?.amount > 1 && (
                <SubCol>
                  <SubRow isTitle>
                    <Text style={commonStyle.subRowTitleText}>
                      {t('page.signTx.amount')}
                    </Text>
                  </SubRow>

                  <SubRow>
                    <Text style={commonStyle.secondaryText}>
                      Amount: {actionData?.nft?.amount}
                    </Text>
                  </SubRow>
                </SubCol>
              )}
            </SubTable>
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
                }}>
                <View ref={sendNftAddressRef}>
                  <Values.Address address={actionData.to} chain={chain} />
                </View>
              </ViewMore>
            </View>
          </Row>
        </Col>
        <SubTable target={sendNftAddressRef}>
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
              <SubRow>
                <Text>{isLabelAddress ? t('page.signTx.label') : ' '}</Text>
              </SubRow>
              <SubRow>
                {isLabelAddress ? (
                  <LogoWithText
                    text={requireData.name}
                    logo={INTERNAL_REQUEST_SESSION.icon}
                    logoSize={14}
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
            engineResult={engineResultMap['1037']}
            dangerText={t('page.signTx.send.contractNotOnThisChain')}
            noTitle
            id="1037"
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
            dangerText={t('page.signTx.send.receiverIsTokenAddress')}
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
                engineResult={engineResultMap['1039']}
                dangerText={t('page.signTx.send.notTopupAddress')}
                id="1039"
              />
              <SecurityListItem
                noTitle
                engineResult={engineResultMap['1038']}
                dangerText={t('page.signTx.sendNFT.nftNotSupport')}
                id="1038"
              />
            </>
          )}
          <SecurityListItem
            title={t('page.signTx.transacted')}
            engineResult={engineResultMap['1036']}
            warningText={<Values.Transacted value={false} />}
            id="1036"
          />
          <SecurityListItem
            title={t('page.signTx.tokenApprove.flagByRabby')}
            engineResult={engineResultMap['1143']}
            dangerText={t('page.signTx.send.scamAddress')}
            id="1143"
          />
          <SecurityListItem
            title={t('page.signTx.send.whitelistTitle')}
            engineResult={engineResultMap['1042']}
            safeText={t('page.signTx.send.onMyWhitelist')}
            id="1042"
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default SendNFT;
