import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { Chain } from '@debank/common';
import { ContractDesc, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import LogoWithText from '../LogoWithText';
import { ellipsisTokenSymbol, getTokenSymbol } from '@/utils/token';
import { getStyle } from '../ViewMore';
import { useThemeColors } from '@/hooks/theme';

interface ReceiverData {
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
  }, [data]);

  return (
    <View>
      <View style={styles.title}>
        <Text>{t('page.signTx.send.sendTo')}</Text>
        <Values.Address
          address={data.address}
          chain={data.chain}
          iconWidth="14px"
        />
      </View>
      <Table style={styles.viewMoreTable}>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.addressNote')}</Text>
          </Row>
          <Row>
            <Values.AddressMemo address={data.address} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.addressTypeTitle')}</Text>
          </Row>
          <Row>
            <View>
              <Text>{receiverType}</Text>
              {((data.contract && !contractOnCurrentChain) ||
                data.name ||
                contractOnCurrentChain?.multisig) && (
                <View className="desc-list">
                  {contractOnCurrentChain &&
                    contractOnCurrentChain.multisig && (
                      <Text>
                        MultiSig: {contractOnCurrentChain.multisig.name}
                      </Text>
                    )}
                  {data.contract && !contractOnCurrentChain && (
                    <Text>{t('page.signTx.send.notOnThisChain')}</Text>
                  )}
                  {data.name && <Text>{data.name}</Text>}
                </View>
              )}
            </View>
          </Row>
        </Col>
        {data.cex && (
          <Col>
            <Row style={styles.firstRow}>
              <Text>{t('page.signTx.send.cexAddress')}</Text>
            </Row>
            <Row>
              <View>
                <LogoWithText logo={data.cex.logo} text={data.cex.name} />
                {(!data.cex.isDeposit || !data.cex.supportToken) && (
                  <View className="desc-list">
                    {!data.cex.isDeposit && (
                      <Text>{t('page.signTx.send.notTopupAddress')}</Text>
                    )}
                    {!data.cex.supportToken && (
                      <Text>
                        {t('page.signTx.send.tokenNotSupport', [
                          data.token
                            ? ellipsisTokenSymbol(getTokenSymbol(data.token))
                            : 'NFT',
                        ])}
                      </Text>
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
              <Text>{t('page.signTx.send.receiverIsTokenAddress')}</Text>
            </Row>
            <Row>
              <Values.Boolean value={data.isTokenContract} />
            </Row>
          </Col>
        )}
        <Col>
          <Row style={styles.firstRow}>
            <Text>
              {data.contract
                ? t('page.signTx.deployTimeTitle')
                : t('page.signTx.firstOnChain')}
            </Text>
          </Row>
          <Row>
            <Values.TimeSpan value={bornAt} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.send.addressBalanceTitle')}</Text>
          </Row>
          <Row>
            <Values.USDValue value={data.usd_value} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.transacted')}</Text>
          </Row>
          <Row>
            <Values.Boolean value={data.hasTransfer} />
          </Row>
        </Col>
        <Col
          style={{
            borderBottomWidth: 0,
          }}>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.send.whitelistTitle')}</Text>
          </Row>
          <Row>
            <Text>
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
