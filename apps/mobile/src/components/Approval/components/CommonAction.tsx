import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import Warning2SVG from '@/assets/icons/sign/tx/warning-2.svg';
import CertifiedSVG from '@/assets/icons/sign/tx/certified.svg';
import { ProtocolListItem } from './Actions/components/ProtocolListItem';
import { SecurityListItem } from './Actions/components/SecurityListItem';
import ViewMore from './Actions/components/ViewMore';
import { ContractRequireData } from './TypedDataActions/utils';
import { Col, Row, Table } from './Actions/components/Table';
import * as Values from './Actions/components/Values';
import { Chain } from '@debank/common';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import DescItem from './Actions/components/DescItem';
import { StyleSheet, Text } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '../hooks/useCommonStyle';
import { Tip } from '@/components/Tip';

const { isSameAddress } = addressUtils;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    rowTitle: {
      width: 100,
    },
    description: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
  });

type CommonActions = {
  desc: string;
  is_asset_changed: boolean;
  is_involving_privacy: boolean;
};

export const CommonAction = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: CommonActions;
  requireData?: ContractRequireData;
  chain?: Chain;
  engineResults: Result[];
}) => {
  const { t } = useTranslation();
  const actionData = data!;
  const {
    userData: { contractWhitelist },
    init,
  } = useApprovalSecurityEngine();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const commonStyle = useCommonStyle();

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain?.serverId &&
        isSameAddress(item.address, requireData?.id ?? ''),
    );
  }, [contractWhitelist, requireData]);

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);

  React.useEffect(() => {
    init();
  }, []);

  const descTip = React.useMemo(() => {
    if (actionData.is_asset_changed && actionData.is_involving_privacy) {
      return t('page.signTx.common.descTipWarningBoth');
    } else if (actionData.is_asset_changed) {
      return t('page.signTx.common.descTipWarningAssets');
    } else if (actionData.is_involving_privacy) {
      return t('page.signTx.common.descTipWarningPrivacy');
    }
    return t('page.signTx.common.descTipSafe');
  }, []);

  return (
    <Table>
      {requireData && chain ? (
        <Col>
          <Row style={styles.rowTitle} isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.common.interactContract')}
            </Text>
          </Row>
          <Row>
            <Values.Address address={requireData.id} chain={chain} />
            <DescItem>
              <ProtocolListItem protocol={requireData.protocol} />
            </DescItem>
            <DescItem>
              <Values.Interacted value={requireData.hasInteraction} />
            </DescItem>

            {isInWhitelist && (
              <DescItem>
                <Text>{t('page.signTx.markAsTrust')}</Text>
              </DescItem>
            )}

            <SecurityListItem
              id="1135"
              engineResult={engineResultMap['1135']}
              forbiddenText={t('page.signTx.markAsBlock')}
            />

            <SecurityListItem
              id="1137"
              engineResult={engineResultMap['1137']}
              warningText={t('page.signTx.markAsBlock')}
            />
            <DescItem>
              <ViewMore
                type="contract"
                data={{
                  hasInteraction: requireData.hasInteraction,
                  bornAt: requireData.bornAt,
                  protocol: requireData.protocol,
                  rank: requireData.rank,
                  address: requireData.id,
                  chain,
                }}
              />
            </DescItem>
          </Row>
        </Col>
      ) : null}
      <Col>
        <Row style={styles.rowTitle} isTitle>
          <Text>{t('page.signTx.common.description')}</Text>
        </Row>
        <Row style={styles.description}>
          <Text>{actionData.desc}</Text>
          <Tip content={descTip}>
            {actionData.is_asset_changed || actionData.is_involving_privacy ? (
              <Warning2SVG />
            ) : null}
            {!actionData.is_asset_changed &&
            !actionData.is_involving_privacy ? (
              <CertifiedSVG />
            ) : null}
          </Tip>
        </Row>
      </Col>
    </Table>
  );
};
