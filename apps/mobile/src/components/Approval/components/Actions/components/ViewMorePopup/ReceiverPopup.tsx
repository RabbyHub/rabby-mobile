import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { Chain } from '@/constant/chains';
import { ContractDesc, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
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

export interface ReceiverData {
  title?: string;
  address: string;
  chain: Chain;
  eoa: {
    id: string;
    bornAt: number;
  } | null;
  cex: {
    id: string;
    name: string;
    logo: string;
    bornAt: number;
    isDeposit: boolean;
    supportToken?: boolean;
  } | null;
  contract: Record<string, ContractDesc> | null;
  usd_value: number;
  hasTransfer: boolean;
  isTokenContract: boolean;
  name: string | null;
  onTransferWhitelist: boolean;
  token?: TokenItem;
  isLabelAddress?: boolean;
  labelAddressLogo?: string;
  hasReceiverMnemonicInWallet?: boolean;
  hasReceiverPrivateKeyInWallet?: boolean;
  rank?: number;
}

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
      return 'Contract';
    }
    if (data.eoa) {
      return 'EOA';
    }
    if (data.cex) {
      return 'EOA';
    }
  }, [data]);

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
        <Values.Address
          address={data.address}
          chain={data.chain}
          iconWidth="14px"
        />
      </View>
      <Table style={styles.viewMoreTable}>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addressNote')}
            </Text>
          </Row>
          <Row>
            <Values.AddressMemo
              address={data.address}
              textStyle={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addressTypeTitle')}
            </Text>
          </Row>
          <Row>
            <View>
              <Text style={commonStyle.primaryText}>{receiverType}</Text>
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
                  {data.name && (
                    <DescItem>
                      <Text style={commonStyle.secondaryText}>{data.name}</Text>
                    </DescItem>
                  )}
                </View>
              )}
            </View>
          </Row>
        </Col>
        {data.hasReceiverMnemonicInWallet && (
          <Col>
            <Row>
              <Text>{t('page.signTx.addressSource')}</Text>
            </Row>
            <Row>
              <Text>{t('page.signTx.send.fromMySeedPhrase')}</Text>
            </Row>
          </Col>
        )}
        {data.hasReceiverPrivateKeyInWallet && (
          <Col>
            <Row>
              <Text>{t('page.signTx.addressSource')}</Text>
            </Row>
            <Row>
              <Text>{t('page.signTx.send.fromMyPrivateKey')}</Text>
            </Row>
          </Col>
        )}
        {data.name && isLabelAddress && (
          <Col>
            <Row>
              <Text>{t('page.signTx.label')}</Text>
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
            <Row style={styles.firstRow}>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.send.cexAddress')}
              </Text>
            </Row>
            <Row>
              <View>
                <LogoWithText
                  logo={data.cex.logo}
                  text={
                    <Text style={commonStyle.primaryText}>{data.cex.name}</Text>
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
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.send.receiverIsTokenAddress')}
              </Text>
            </Row>
            <Row>
              <Values.Boolean
                value={data.isTokenContract}
                style={commonStyle.primaryText}
              />
            </Row>
          </Col>
        )}
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {data.contract
                ? t('page.signTx.deployTimeTitle')
                : t('page.signTx.firstOnChain')}
            </Text>
          </Row>
          <Row>
            <Values.TimeSpan value={bornAt} style={commonStyle.primaryText} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.send.addressBalanceTitle')}
            </Text>
          </Row>
          <Row>
            <Values.USDValue
              value={data.usd_value}
              style={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.transacted')}
            </Text>
          </Row>
          <Row>
            <Values.Boolean
              value={data.hasTransfer}
              style={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col
          style={{
            borderBottomWidth: 0,
          }}>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.send.whitelistTitle')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
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
