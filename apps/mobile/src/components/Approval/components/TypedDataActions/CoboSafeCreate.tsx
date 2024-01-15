import React from 'react';
import { useTranslation } from 'react-i18next';
import { Col, Row, Table } from '../Actions/components/Table';
import * as Values from '../Actions/components/Values';
import LogoWithText from '../Actions/components/LogoWithText';
import { TypedDataActionData } from './utils';
import { Text, View } from 'react-native';

const CoboSafeCreate = ({
  data,
}: {
  data: TypedDataActionData['coboSafeCreate'];
}) => {
  const { t } = useTranslation();
  const actionData = data!;

  return (
    <View>
      <Table>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.coboSafeCreate.safeWalletTitle')}</Text>
          </Row>
          <Row>
            <View>
              <Values.Address address={actionData.multisig_id} />
            </View>
            <View className="desc-list">
              <View>
                <Values.AddressMemo address={actionData.multisig_id} />
              </View>

              <LogoWithText
                logo={require('@/assets/icons/wallet/safe.svg')}
                text="Safe"
                logoSize={14}
                logoRadius={16}
                // eslint-disable-next-line react-native/no-inline-styles
                textStyle={{
                  fontWeight: 'normal',
                  fontSize: 13,
                  lineHeight: 15,
                  color: '#4B4D59',
                }}
              />
            </View>
          </Row>
        </Col>
        <Col>
          <Row isTitle>
            <Text>{t('page.signTx.coboSafeCreate.descriptionTitle')}</Text>
          </Row>
          <Row>
            <Text>{actionData.desc}</Text>
          </Row>
        </Col>
      </Table>
    </View>
  );
};

export default CoboSafeCreate;
