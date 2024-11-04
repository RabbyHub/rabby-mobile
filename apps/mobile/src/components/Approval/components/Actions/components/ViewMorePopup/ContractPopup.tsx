import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import { Chain } from '@/constant/chains';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useApprovalSecurityEngine } from '@/components/Approval/hooks/useApprovalSecurityEngine';
import { getStyle } from '../getStyle';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

const { isSameAddress } = addressUtils;

interface ContractData {
  address: string;
  chain: Chain;
  protocol: {
    name: string;
    logo_url: string;
  } | null;
  bornAt: number | null;
  rank: number | null;
  title?: string;
  hasInteraction: boolean;
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
  const commonStyle = useCommonStyle();
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
        <Text style={styles.titleText}>
          {data.title || t('page.signTx.interactContract')}
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
              {t('page.signTx.deployTimeTitle')}
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
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.myMark')}
            </Text>
          </Row>
          <Row>
            <Values.AddressMark
              textStyle={commonStyle.detailPrimaryText}
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
