import { View, Text } from 'react-native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '@/components/Approval/hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useThemeColors } from '@/hooks/theme';
import { getStyle } from '../getStyle';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

const { isSameAddress } = addressUtils;

interface NFTSpenderData {
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
  data: NFTSpenderData;
}

export interface NFTSpenderPopupProps extends Props {
  type: 'nftSpender';
}

export const NFTSpenderPopup: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const { userData } = useApprovalSecurityEngine();
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const commonStyle = useCommonStyle();
  const { contractBlacklist, contractWhitelist } = userData;

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
      <View style={styles.title}>
        <Text style={styles.titleText}>
          {data.isRevoke
            ? t('page.signTx.revokeTokenApprove.revokeFrom')
            : t('page.signTx.tokenApprove.approveTo')}
        </Text>

        <Values.AddressWithCopy
          address={data.spender}
          chain={data.chain}
          iconWidth="14px"
        />
      </View>
      <Table style={styles.viewMoreTable}>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.protocolTitle')}
            </Text>
          </Row>
          <Row>
            <Values.Protocol
              value={data.protocol}
              textStyle={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.addressTypeTitle')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.detailPrimaryText}>
              {data.isEOA ? 'EOA' : 'Contract'}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {data.isEOA
                ? t('page.signTx.firstOnChain')
                : t('page.signTx.deployTimeTitle')}
            </Text>
          </Row>
          <Row>
            <Values.TimeSpan
              value={data.bornAt}
              style={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row
            tip={t('page.signTx.nftApprove.nftContractTrustValueTip')}
            style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.trustValue')}
            </Text>
          </Row>
          <Row>
            {data.riskExposure === null ? (
              <Text style={commonStyle.detailPrimaryText}>-</Text>
            ) : (
              <Values.USDValue
                value={data.riskExposure}
                style={commonStyle.detailPrimaryText}
              />
            )}
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.popularity')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.detailPrimaryText}>
              {data.rank
                ? // @ts-ignore
                  t('page.signTx.contractPopularity', [
                    data.rank,
                    data.chain.name,
                  ])
                : '-'}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.interacted')}
            </Text>
          </Row>
          <Row>
            <Values.Boolean value={data.hasInteraction} />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.addressNote')}
            </Text>
          </Row>
          <Row>
            <Values.AddressMemo
              address={data.spender}
              textStyle={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.myMark')}
            </Text>
          </Row>
          <Row>
            <Values.AddressMark
              isContract
              address={data.spender}
              chain={data.chain}
              onBlacklist={isInBlackList}
              onWhitelist={isInWhiteList}
              onChange={() => null}
              textStyle={commonStyle.detailPrimaryText}
            />
          </Row>
        </Col>
        {data.isDanger && (
          <Col>
            <Row style={styles.firstRow}>
              <Text>{t('page.signTx.tokenApprove.flagByRabby')}</Text>
            </Row>
            <Row>
              <Values.Boolean
                value={!!data.isDanger}
                style={commonStyle.detailPrimaryText}
              />
            </Row>
          </Col>
        )}
      </Table>
    </View>
  );
};
