import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import LogoWithText from '../LogoWithText';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { getStyle } from '../getStyle';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';
import DescItem from '../DescItem';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { type ReceiverData } from '@rabby-wallet/rabby-action';

export interface Props {
  data: ReceiverData;
}

export interface ReceiverPopupProps extends Props {
  type: 'receiver';
}

export const ReceiverPopup: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const commonStyle = useCommonStyle();

  const receiverType = useMemo(() => {
    if (data.contract) {
      return t('page.signTx.contract');
    }
    if (data.eoa) {
      return t('page.signTx.tokenApprove.eoaAddress');
    }
    if (data.cex) {
      return t('page.signTx.tokenApprove.eoaAddress');
    }
  }, [data, t]);

  const contractOnCurrentChain = useMemo(() => {
    if (!data.contract || !data.contract[data.chain.serverId]) return null;
    return data.contract[data.chain.serverId];
  }, [data]);

  const bornAt = useMemo(() => {
    if (data.contract) {
      if (contractOnCurrentChain) {
        return contractOnCurrentChain.create_at;
      } else {
        return null;
      }
    }
    if (data.cex) return data.cex.bornAt;
    if (data.eoa) return data.eoa.bornAt;
    return null;
  }, [data, contractOnCurrentChain]);

  const isLabelAddress =
    data.isLabelAddress ||
    !!(data.name && Object.values(ALIAS_ADDRESS).includes(data.name));

  return (
    <View>
      <View style={styles.title}>
        <Text style={styles.titleText}>
          {data.title || t('page.signTx.send.sendTo')}
        </Text>
        <Values.AddressWithCopy
          address={data.address}
          chain={data.chain}
          iconWidth="14px"
          style={styles.valueAddress}
        />
      </View>
      <Table style={styles.viewMoreTable}>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.addressNote')}
            </Text>
          </Row>
          <Row>
            <Values.AddressMemo
              address={data.address}
              textStyle={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row isTitle style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.addressTypeTitle')}
            </Text>
          </Row>
          <Row>
            <View style={StyleSheet.flatten({ alignItems: 'flex-end' })}>
              <Text style={commonStyle.detailPrimaryText}>{receiverType}</Text>
              {((data.contract && !contractOnCurrentChain) ||
                data.name ||
                contractOnCurrentChain?.multisig) && (
                <View>
                  {contractOnCurrentChain &&
                    contractOnCurrentChain.multisig && (
                      <DescItem>
                        <Text style={commonStyle.secondaryText}>
                          MultiSig: {contractOnCurrentChain.multisig.name}
                        </Text>
                      </DescItem>
                    )}
                  {data.contract && !contractOnCurrentChain && (
                    <DescItem>
                      <Text style={commonStyle.secondaryText}>
                        {t('page.signTx.send.notOnThisChain')}
                      </Text>
                    </DescItem>
                  )}
                  {data.name && !isLabelAddress && (
                    <DescItem>
                      <Text style={commonStyle.secondaryText}>
                        {data.name.replace(/^Token: /, 'Token ') +
                          ' contract address'}
                      </Text>
                    </DescItem>
                  )}
                </View>
              )}
            </View>
          </Row>
        </Col>
        {data.hasReceiverMnemonicInWallet && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTx.addressSource')}</Text>
            </Row>
            <Row>
              <Text>{t('page.signTx.send.fromMySeedPhrase')}</Text>
            </Row>
          </Col>
        )}
        {data.hasReceiverPrivateKeyInWallet && (
          <Col>
            <Row isTitle>
              <Text>{t('page.signTx.addressSource')}</Text>
            </Row>
            <Row>
              <Text>{t('page.signTx.send.fromMyPrivateKey')}</Text>
            </Row>
          </Col>
        )}
        {data.name && isLabelAddress && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.detailRowTitleText}>
                {t('page.signTx.label')}
              </Text>
            </Row>
            <Row>
              <LogoWithText
                text={data.name}
                logo={data.labelAddressLogo || INTERNAL_REQUEST_SESSION.icon}
                logoRadius={16}
                logoSize={14}
                textStyle={StyleSheet.flatten({
                  fontSize: 13,
                  color: colors['neutral-body'],
                })}
              />
            </Row>
          </Col>
        )}
        {data.cex && (
          <Col>
            <Row isTitle style={styles.firstRow}>
              <Text style={commonStyle.detailRowTitleText}>
                {t('page.signTx.send.cexAddress')}
              </Text>
            </Row>
            <Row>
              <View>
                <LogoWithText
                  logo={data.cex.logo}
                  text={
                    <Text style={commonStyle.detailPrimaryText}>
                      {data.cex.name}
                    </Text>
                  }
                />
                {(!data.cex.isDeposit || !data.cex.supportToken) && (
                  <View>
                    {!data.cex.isDeposit && (
                      <DescItem>
                        <Text style={commonStyle.secondaryText}>
                          {t('page.signTx.send.notTopupAddress')}
                        </Text>
                      </DescItem>
                    )}
                    {!data.cex.supportToken && (
                      <DescItem>
                        <Text style={commonStyle.secondaryText}>
                          {/* @ts-ignore */}
                          {t('page.signTx.send.tokenNotSupport', [
                            data.token
                              ? ellipsisTokenSymbol(getTokenSymbol(data.token))
                              : 'NFT',
                          ])}
                        </Text>
                      </DescItem>
                    )}
                  </View>
                )}
              </View>
            </Row>
          </Col>
        )}
        {data.isTokenContract && (
          <Col>
            <Row style={styles.firstRow}>
              <Text style={commonStyle.detailRowTitleText}>
                {t('page.signTx.send.receiverIsTokenAddress')}
              </Text>
            </Row>
            <Row>
              <Values.Boolean
                value={data.isTokenContract}
                style={commonStyle.detailPrimaryText}
              />
            </Row>
          </Col>
        )}
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {data.contract
                ? t('page.signTx.deployTimeTitle')
                : t('page.signTx.firstOnChain')}
            </Text>
          </Row>
          <Row>
            <Values.TimeSpan
              value={bornAt}
              style={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.send.addressBalanceTitle')}
            </Text>
          </Row>
          <Row>
            <Values.USDValue
              value={data.usd_value}
              style={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.transacted')}
            </Text>
          </Row>
          <Row>
            <Values.Boolean
              value={data.hasTransfer}
              style={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col
          style={{
            borderBottomWidth: 0,
          }}>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.send.whitelistTitle')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.detailPrimaryText}>
              {data.onTransferWhitelist
                ? t('page.signTx.send.onMyWhitelist')
                : t('page.signTx.send.notOnWhitelist')}
            </Text>
          </Row>
        </Col>
      </Table>
    </View>
  );
};
