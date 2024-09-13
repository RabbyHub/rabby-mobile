import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Result } from '@rabby-wallet/rabby-security-engine';
import {
  ParsedTransactionActionData,
  TransferOwnerRequireData,
} from '@rabby-wallet/rabby-action';
import { Table, Col, Row } from './components/Table';
import * as Values from './components/Values';
import ViewMore from './components/ViewMore';
import { SecurityListItem } from './components/SecurityListItem';
import { SubCol, SubRow, SubTable } from './components/SubTable';
import { Chain } from '@/constant/chains';
import { Text, View } from 'react-native';
import useCommonStyle from '../../hooks/useCommonStyle';

const TransferOwner = ({
  data,
  requireData,
  chain,
  engineResults,
}: {
  data: ParsedTransactionActionData['transferOwner'];
  requireData: TransferOwnerRequireData;
  chain: Chain;
  engineResults: Result[];
}) => {
  const actionData = data!;
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();

  const engineResultMap = useMemo(() => {
    const map: Record<string, Result> = {};
    engineResults.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [engineResults]);
  const addressRef = React.useRef(null);

  const receiver = requireData.receiver;

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.transferOwner.description')}
            </Text>
          </Row>
          <Row style={{ flex: 1 }}>
            <Text style={commonStyle.primaryText}>
              {actionData.description}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row isTitle itemsCenter>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.send.sendTo')}
            </Text>
          </Row>
          <Row>
            <ViewMore
              type="receiver"
              data={{
                address: actionData.to,
                chain,
                eoa: receiver!.eoa,
                cex: receiver!.cex,
                contract: receiver!.contract,
                usd_value: receiver!.usd_value,
                hasTransfer: receiver!.hasTransfer,
                isTokenContract: receiver!.isTokenContract,
                name: receiver!.name,
                onTransferWhitelist: receiver!.onTransferWhitelist,
                hasReceiverMnemonicInWallet:
                  receiver!.hasReceiverMnemonicInWallet,
                hasReceiverPrivateKeyInWallet:
                  receiver!.hasReceiverPrivateKeyInWallet,
              }}>
              <View ref={addressRef}>
                <Values.Address address={actionData.to} chain={chain} />
              </View>
            </ViewMore>
          </Row>
        </Col>
        <SubTable target={addressRef}>
          <SubCol>
            <SubRow isTitle>
              <Text style={commonStyle.subRowTitleText}>
                {t('page.signTx.addressNote')}
              </Text>
            </SubRow>
            <SubRow>
              <Values.AddressMemo address={actionData.to} />
            </SubRow>
          </SubCol>
          {requireData.receiver && (
            <SubCol>
              <SubRow isTitle>
                <Text style={commonStyle.subRowTitleText}>
                  {t('page.signTx.transacted')}
                </Text>
              </SubRow>
              <SubRow>
                <Values.Transacted value={requireData.receiver.hasTransfer} />
              </SubRow>
            </SubCol>
          )}
          <SecurityListItem
            title={t('page.signTx.send.whitelistTitle')}
            engineResult={engineResultMap['1151']}
            dangerText={t('page.signTx.send.notOnWhitelist')}
            id="1151"
          />
        </SubTable>
      </Table>
    </View>
  );
};

export default TransferOwner;
