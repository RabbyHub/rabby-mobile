import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, Text } from 'react-native';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import { Chain } from '@debank/common';
import { CollectionWithFloorPrice } from '@rabby-wallet/rabby-api/dist/types';
import { formatAmount } from '@/utils/number';
import { getStyle } from '../ViewMore';
import { useThemeColors } from '@/hooks/theme';

interface CollectionData {
  collection: CollectionWithFloorPrice;
  chain: Chain;
}

export interface Props {
  data: CollectionData;
}

export interface CollectionPopupProps extends Props {
  type: 'collection';
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: '500', // Assuming this is the correct fontWeight
    color: '#333',
    flexDirection: 'row',
    marginBottom: 10,
  },
  left: {
    color: '#4b4d59',
    marginRight: 6,
    fontWeight: 'normal',
  },
  right: {
    flex: 1,
    // whiteSpace: 'nowrap',
    overflow: 'hidden',
    // textOverflow: 'ellipsis',
  },
});

export const CollectionPopup: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const viewMoreStyles = getStyle(colors);
  return (
    <div>
      <View style={styles.title}>
        <Text style={styles.left}>{t('page.signTx.nftCollection')}</Text>
        <Text style={styles.right}>{data.collection.name}</Text>
      </View>
      <Table style={viewMoreStyles.viewMoreTable}>
        <Col>
          <Row style={viewMoreStyles.firstRow}>
            <Text>{t('page.signTx.floorPrice')}</Text>
          </Row>
          <Row>
            <Text>
              {data.collection.floor_price !== null
                ? `${formatAmount(data.collection.floor_price)} ETH`
                : '-'}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row style={viewMoreStyles.firstRow}>
            <Text>{t('page.signTx.contractAddress')}</Text>
          </Row>
          <Row>
            <Values.Address address={data.collection.id} chain={data.chain} />
          </Row>
        </Col>
      </Table>
    </div>
  );
};
