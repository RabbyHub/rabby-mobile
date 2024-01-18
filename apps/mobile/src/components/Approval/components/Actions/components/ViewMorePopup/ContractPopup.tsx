import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import { Chain } from '@debank/common';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '@/components/Approval/hooks/useApprovalSecurityEngine';
import { getStyle } from '../ViewMore';
import { useThemeColors } from '@/hooks/theme';

const { isSameAddress } = addressUtils;

interface ContractData {
  address: string;
  chain: Chain;
  protocol: {
    name: string;
    logo_url: string;
  } | null;
  hasInteraction: boolean;
  bornAt: number | null;
  rank: number | null;
  title?: string;
}

export interface Props {
  data: ContractData;
}

export interface ContractPopupProps extends Props {
  type: 'contract';
}

export const ContractPopup: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const { userData } = useApprovalSecurityEngine();
  const { contractBlacklist, contractWhitelist } = userData;
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const { isInBlackList, isInWhiteList } = useMemo(() => {
    return {
      isInBlackList: contractBlacklist.some(
        ({ address, chainId }) =>
          isSameAddress(address, data.address) &&
          chainId === data.chain.serverId,
      ),
      isInWhiteList: contractWhitelist.some(
        ({ address, chainId }) =>
          isSameAddress(address, data.address) &&
          chainId === data.chain.serverId,
      ),
    };
  }, [data.address, data.chain, contractBlacklist, contractWhitelist]);
  return (
    <View>
      <View style={styles.title}>
        <Text>{data.title || t('page.signTx.interactContract')}</Text>
        <Values.Address
          address={data.address}
          chain={data.chain}
          iconWidth="14px"
        />
      </View>
      <Table style={styles.viewMoreTable}>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.protocolTitle')}</Text>
          </Row>
          <Row>
            <Values.Protocol value={data.protocol} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.interacted')}</Text>
          </Row>
          <Row>
            <Values.Boolean value={data.hasInteraction} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.deployTimeTitle')}</Text>
          </Row>
          <Row>
            <Values.TimeSpan value={data.bornAt} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.popularity')}</Text>
          </Row>
          <Row>
            <Text>
              {data.rank
                ? t('page.signTx.contractPopularity', [
                    data.rank,
                    data.chain.name,
                  ])
                : '-'}
            </Text>
          </Row>
        </Col>
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
            <Text>{t('page.signTx.myMark')}</Text>
          </Row>
          <Row>
            <Values.AddressMark
              isContract
              address={data.address}
              chain={data.chain}
              onBlacklist={isInBlackList}
              onWhitelist={isInWhiteList}
              onChange={() => null}
            />
          </Row>
        </Col>
      </Table>
    </View>
  );
};
