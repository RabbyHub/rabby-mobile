import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import { ProtocolListItem } from './Actions/components/ProtocolListItem';
import { SecurityListItem } from './Actions/components/SecurityListItem';
import ViewMore from './Actions/components/ViewMore';
import { Col, Row, Table } from './Actions/components/Table';
import * as Values from './Actions/components/Values';
import { Chain } from '@/constant/chains';
import { useApprovalSecurityEngine } from '../hooks/useApprovalSecurityEngine';
import { addressUtils } from '@rabby-wallet/base-utils';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '../hooks/useCommonStyle';
import { SubTable, SubCol, SubRow } from './Actions/components/SubTable';
import BigNumber from 'bignumber.js';
import { formatTokenAmount } from '@/utils/number';
import {
  ContractRequireData,
  ContractCallRequireData,
} from '@rabby-wallet/rabby-action';

const { isSameAddress } = addressUtils;

type CommonActions = {
  title: string;
  desc: string;
  is_asset_changed: boolean;
  is_involving_privacy: boolean;
  receiver?: string;
  from?: string;
};

export const CommonAction = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: CommonActions;
  requireData?: ContractRequireData | ContractCallRequireData; // ContractRequireData for signTypedData, ContractCallRequireData for signTransaction
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
  const commonStyle = useCommonStyle();

  const isInWhitelist = useMemo(() => {
    return contractWhitelist.some(
      item =>
        item.chainId === chain?.serverId &&
        isSameAddress(item.address, requireData?.id ?? ''),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addressInfo = requireData
    ? (requireData as ContractCallRequireData).unexpectedAddr
    : undefined;

  const hasReceiver = useMemo(() => {
    if (!actionData.receiver || !actionData.from) return false;
    return !isSameAddress(actionData.receiver, actionData.from);
  }, [actionData]);

  const commonActionAddressRef = React.useRef(null);
  const commonActionReceiverRef = React.useRef(null);

  return (
    <Table>
      {requireData && Object.keys(requireData).length && chain ? (
        <>
          <Col>
            <Row isTitle itemsCenter>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.common.interactContract')}
              </Text>
            </Row>
            <Row>
              <ViewMore
                type="contract"
                data={{
                  bornAt: requireData.bornAt,
                  protocol: requireData.protocol,
                  rank: requireData.rank,
                  address: requireData.id,
                  hasInteraction: requireData.hasInteraction,
                  chain,
                }}>
                <View ref={commonActionAddressRef}>
                  <Values.Address address={requireData.id} chain={chain} />
                </View>
              </ViewMore>
            </Row>
          </Col>
          <SubTable target={commonActionAddressRef}>
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.protocol')}
                </Text>
              </SubRow>
              <SubRow>
                <ProtocolListItem
                  style={commonStyle.subRowText}
                  protocol={requireData.protocol}
                />
              </SubRow>
            </SubCol>

            {isInWhitelist && (
              <SubCol>
                <SubRow isTitle>
                  <Text style={commonStyle.subRowTitleText}>
                    {t('page.signTx.myMark')}
                  </Text>
                </SubRow>
                <SubRow>
                  <Text style={commonStyle.subRowText}>
                    {t('page.signTx.trusted')}
                  </Text>
                </SubRow>
              </SubCol>
            )}

            <SecurityListItem
              id="1135"
              engineResult={engineResultMap['1135']}
              forbiddenText={t('page.signTx.markAsBlock')}
              title={t('page.signTx.myMark')}
            />

            <SecurityListItem
              id="1137"
              engineResult={engineResultMap['1137']}
              warningText={t('page.signTx.markAsBlock')}
              title={t('page.signTx.myMark')}
            />
          </SubTable>
        </>
      ) : null}
      <Col>
        <Row isTitle style={{ flex: 0, marginRight: 10 }}>
          <Text style={{ ...commonStyle.rowTitleText }}>
            {t('page.signTx.common.description')}
          </Text>
        </Row>
        <Row style={{ flex: 1 }}>
          <Text
            style={{
              ...commonStyle.primaryText,
              textAlign: 'right',
              width: '100%',
            }}>
            {actionData.desc}
          </Text>
        </Row>
      </Col>
      {(requireData as ContractCallRequireData)?.payNativeTokenAmount &&
        new BigNumber(
          (requireData as ContractCallRequireData).payNativeTokenAmount,
        ).gt(0) && (
          <Col>
            <Row isTitle>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.contractCall.payNativeToken', {
                  symbol: (requireData as ContractCallRequireData)
                    .nativeTokenSymbol,
                })}
              </Text>
            </Row>
            {
              <Row>
                <Text style={commonStyle.primaryText}>
                  {formatTokenAmount(
                    new BigNumber(
                      (
                        requireData as ContractCallRequireData
                      ).payNativeTokenAmount,
                    )
                      .div(1e18)
                      .toFixed(),
                  )}{' '}
                  {(requireData as ContractCallRequireData).nativeTokenSymbol}
                </Text>
              </Row>
            }
          </Col>
        )}
      {hasReceiver && actionData.receiver && addressInfo && (
        <>
          <Col>
            <Row isTitle itemsCenter>
              <Text style={commonStyle.rowTitleText}>
                {t('page.signTx.swap.receiver')}
              </Text>
            </Row>
            <Row>
              <View>
                <ViewMore
                  type="receiver"
                  data={{
                    title: t('page.signTx.contractCall.receiver'),
                    address: addressInfo.address,
                    chain: addressInfo.chain,
                    eoa: addressInfo.eoa,
                    cex: addressInfo.cex,
                    contract: addressInfo.contract,
                    usd_value: addressInfo.usd_value,
                    hasTransfer: addressInfo.hasTransfer,
                    isTokenContract: addressInfo.isTokenContract,
                    name: addressInfo.name,
                    onTransferWhitelist: addressInfo.onTransferWhitelist,
                  }}>
                  <View ref={commonActionReceiverRef}>
                    <Values.Address
                      address={actionData.receiver}
                      chain={chain}
                    />
                  </View>
                </ViewMore>
              </View>
            </Row>
          </Col>
          <SubTable target={commonActionReceiverRef}>
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.addressNote')}
                </Text>
              </SubRow>
              <SubRow>
                <Values.AddressMemo address={actionData.receiver} />
              </SubRow>
            </SubCol>

            <SecurityListItem
              engineResult={engineResultMap['1139']}
              id="1139"
              dangerText={t('page.signTx.swap.unknownAddress')}
              defaultText={
                <Values.KnownAddress
                  textStyle={commonStyle.subRowNestedText}
                  address={actionData.receiver}
                />
              }
            />
          </SubTable>
        </>
      )}
    </Table>
  );
};
