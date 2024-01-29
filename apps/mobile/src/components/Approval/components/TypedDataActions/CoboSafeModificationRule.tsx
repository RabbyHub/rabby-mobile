import React from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Row, Table } from '../Actions/components/Table';
import { TypedDataActionData } from './utils';
import * as Values from '../Actions/components/Values';
import LogoWithText from '../Actions/components/LogoWithText';
import { Text, View } from 'react-native';
import DescItem from '../Actions/components/DescItem';
import useCommonStyle from '../../hooks/useCommonStyle';

const CoboSafeModificationRule = ({
  data,
}: {
  data: TypedDataActionData['coboSafeModificationRole'];
}) => {
  const { t } = useTranslation();
  const commonStyle = useCommonStyle();
  const actionData = data!;

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text style={commonStyle.rowTitleText}>
              {t('page.signTx.coboSafeModificationRole.safeWalletTitle')}
            </Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.multisig_id} />
            </View>
            <View>
              <DescItem>
                <Values.AddressMemo
                  address={actionData.multisig_id}
                  textStyle={commonStyle.secondaryText}
                />
              </DescItem>
              <DescItem>
                <LogoWithText
                  logo={require('@/assets/icons/wallet/safe.svg')}
                  text="Safe"
                  logoSize={14}
                  logoRadius={16}
                  textStyle={commonStyle.secondaryText}
                />
              </DescItem>
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>
              {t('page.signTx.coboSafeModificationRole.descriptionTitle')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.primaryText}>{actionData.desc}</Text>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default CoboSafeModificationRule;
