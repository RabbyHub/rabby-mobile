import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text } from 'react-native';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import { Chain } from '@debank/common';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '@/components/Approval/hooks/useApprovalSecurityEngine';
import { getStyle } from '../ViewMore';
import { useThemeColors } from '@/hooks/theme';

const { isSameAddress } = addressUtils;

interface SpenderData {
  spender: string;
  chain: Chain;
  protocol: {
    name: string;
    logo_url: string;
  } | null;
  hasInteraction: boolean;
  bornAt: number | null;
  rank: number | null;
  riskExposure: number;
  isEOA: boolean;
  isDanger: boolean | null;
  isRevoke?: boolean;
}

export interface Props {
  data: SpenderData;
}

export interface SpenderPopupProps extends Props {
  type: 'spender';
}

export const SpenderPopup: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const { userData } = useApprovalSecurityEngine();
  const { contractBlacklist, contractWhitelist } = userData;
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const { isInBlackList, isInWhiteList } = useMemo(() => {
    return {
      isInBlackList: contractBlacklist.some(
        ({ address, chainId }) =>
          isSameAddress(address, data.spender) &&
          chainId === data.chain.serverId,
      ),
      isInWhiteList: contractWhitelist.some(
        ({ address, chainId }) =>
          isSameAddress(address, data.spender) &&
          chainId === data.chain.serverId,
      ),
    };
  }, [data.spender, data.chain, contractBlacklist, contractWhitelist]);

  return (
    <View>
      <View className="title">
        <Text>
          {data.isRevoke
            ? t('page.signTx.revokeTokenApprove.revokeFrom')
            : t('page.signTx.tokenApprove.approveTo')}
        </Text>

        <Values.Address
          address={data.spender}
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
            <Text>{t('page.signTx.addressTypeTitle')}</Text>
          </Row>
          <Row>
            <Text>{data.isEOA ? 'EOA' : 'Contract'}</Text>
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>
              {data.isEOA
                ? t('page.signTx.firstOnChain')
                : t('page.signTx.deployTimeTitle')}
            </Text>
          </Row>
          <Row>
            <Values.TimeSpan value={data.bornAt} />
          </Row>
        </Col>
        <Col>
          <Row
            style={styles.firstRow}
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}>
            <Text>{t('page.signTx.trustValue')}</Text>
          </Row>
          <Row>
            {data.riskExposure === null ? (
              <Text>-</Text>
            ) : (
              <Values.USDValue value={data.riskExposure} />
            )}
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
            <Text>{t('page.signTx.interacted')}</Text>
          </Row>
          <Row>
            <Values.Boolean value={data.hasInteraction} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.addressNote')}</Text>
          </Row>
          <Row>
            <Values.AddressMemo address={data.spender} />
          </Row>
        </Col>
        {data.isDanger && (
          <Col>
            <Row style={styles.firstRow}>
              {t('page.signTx.tokenApprove.flagByRabby')}
            </Row>
            <Row>
              <Values.Boolean value={!!data.isDanger} />
            </Row>
          </Col>
        )}
        <Col>
          <Row style={styles.firstRow}>
            <Text>{t('page.signTx.myMark')}</Text>
          </Row>
          <Row>
            <Values.AddressMark
              isContract
              address={data.spender}
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
