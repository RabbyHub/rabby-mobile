import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Table, Col, Row } from '../Table';
import * as Values from '../Values';
import { Chain } from '@/constant/chains';
import NFTWithName from '../NFTWithName';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { formatAmount } from '@/utils/number';
import { getStyle } from '../getStyle';
import { useThemeColors } from '@/hooks/theme';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

interface NFTData {
  nft: NFTItem;
  chain: Chain;
}

export interface Props {
  data: NFTData;
}

export interface NFTPopupProps extends Props {
  type: 'nft';
}

export const NFTPopup: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyle(colors);
  const commonStyle = useCommonStyle();

  return (
    <View>
      <View style={styles.title}>
        <Text
          style={StyleSheet.flatten([
            styles.titleText,
            {
              marginRight: 12,
            },
          ])}>
          NFT
        </Text>
        <NFTWithName nft={data.nft} textStyle={commonStyle.detailPrimaryText} />
      </View>
      <Table style={styles.viewMoreTable}>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.collectionTitle')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.detailPrimaryText}>
              {data.nft.collection ? data.nft.collection.name : '-'}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.floorPrice')}
            </Text>
          </Row>
          <Row>
            <Text style={commonStyle.detailPrimaryText}>
              {data.nft?.collection?.floor_price
                ? `${formatAmount(data?.nft?.collection?.floor_price)} ETH`
                : '-'}
            </Text>
          </Row>
        </Col>
        <Col>
          <Row style={styles.firstRow}>
            <Text style={commonStyle.detailRowTitleText}>
              {t('page.signTx.contractAddress')}
            </Text>
          </Row>
          <Row>
            <Values.AddressWithCopy
              address={data.nft.contract_id}
              chain={data.chain}
            />
          </Row>
        </Col>
      </Table>
    </View>
  );
};
