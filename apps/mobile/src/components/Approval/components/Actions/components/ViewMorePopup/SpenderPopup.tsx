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
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

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
  const commonStyle = useCommonStyle();

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
        <Text
          style={{
            ...commonStyle.primaryText,
            marginRight: 7,
          }}>
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
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.protocolTitle')}
            </Text>
          </Row>
          <Row>
            <Values.Protocol
              value={data.protocol}
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
            <Text style={commonStyle.primaryText}>
              {data.isEOA ? 'EOA' : 'Contract'}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {data.isEOA
                ? t('page.signTx.firstOnChain')
                : t('page.signTx.deployTimeTitle')}
            </Text>
          </Row>
          <Row>
            <Values.TimeSpan
              value={data.bornAt}
              style={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row
            style={styles.firstRow}
            tip={t('page.signTx.tokenApprove.contractTrustValueTip')}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.trustValue')}
            </Text>
          </Row>
          <Row>
            {data.riskExposure === null ? (
              <Text style={commonStyle.primaryText}>-</Text>
            ) : (
              <Values.USDValue
                value={data.riskExposure}
                style={commonStyle.primaryText}
              />
            )}
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.popularity')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>
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
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.interacted')}
            </Text>
          </Row>
          <Row>
            <Values.Boolean
              value={data.hasInteraction}
              style={commonStyle.primaryText}
            />
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.addressNote')}
            </Text>
          </Row>
          <Row>
            <Values.AddressMemo
              address={data.spender}
              textStyle={commonStyle.primaryText}
            />
          </Row>
        </Col>
        {data.isDanger && (
          <Col>
            <Row style={styles.firstRow}>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.tokenApprove.flagByRabby')}
              </Text>
            </Row>
            <Row>
              <Values.Boolean
                value={!!data.isDanger}
                style={commonStyle.primaryText}
              />
            </Row>
          </Col>
        )}
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.rowTitleText}>
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
              textStyle={commonStyle.primaryText}
            />
          </Row>
        </Col>
      </Table>
    </View>
  );
};
