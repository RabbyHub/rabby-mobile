import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { InfoBanner } from './components/InfoBanner';
import { useGetRabbyPoints } from './hooks';
import { AddressItemContextMenu } from '../Address/components/AddressItemContextMenu';
import { AddressPointItem } from './components/AddressItem';

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  stack: {
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  banner: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['brand-light-1']
      : ctx.colors2024['brand-light-4'],
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    color: ctx.colors2024['neutral-title-1'],
    marginBottom: 8,
  },
  bannerDesc: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '600',
    color: ctx.colors2024['neutral-title-1'],
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ctx.colors2024['neutral-line'],
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    padding: 16,
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 16,
    color: ctx.colors2024['neutral-title-1'],
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: ctx.colors2024['brand-light-1'],
  },
  pillText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '600',
    fontSize: 12,
    color: ctx.colors2024['brand-default'],
  },
  table: {
    gap: 12,
  },
  tableHeader: {
    fontSize: 12,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '600',
  },
  rowAmount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '600',
    color: ctx.colors2024['neutral-title-1'],
  },
  claimCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ctx.colors2024['neutral-line'],
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  claimInfo: {
    flex: 1,
    marginRight: 16,
  },
  alias: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    color: ctx.colors2024['neutral-title-1'],
  },
  address: {
    marginTop: 4,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 12,
    color: ctx.colors2024['neutral-foot'],
  },
  claimPoints: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 16,
    color: ctx.colors2024['neutral-title-1'],
  },
  claimButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: ctx.colors2024['brand-light-1'],
  },
  claimButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    color: ctx.colors2024['brand-disable'],
  },
  sectionGap: {
    gap: 20,
  },

  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 12,
  },
  itemGap: {
    marginTop: 12,
  },
}));

const PointsScreen = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const accountPoints = useGetRabbyPoints();
  console.log('accountPoints', accountPoints);

  return (
    <NormalScreenContainer2024 overwriteStyle={styles.screen} fitStatuBar>
      <FlatList
        data={accountPoints}
        keyExtractor={item => `${item.address}-${item.type}-${item.brandName}`}
        style={styles.listContainer}
        renderItem={({ item, index }) => (
          <View
            key={`${item.address}-${item.type}-${item.brandName}-${index}`}
            style={[
              styles.itemGap,
              index === accountPoints.length - 1 && { marginBottom: 32 },
            ]}>
            <AddressItemContextMenu account={item} actions={['copy', 'edit']}>
              <AddressPointItem account={item} />
            </AddressItemContextMenu>
          </View>
        )}
        ListHeaderComponent={<InfoBanner />}
      />
    </NormalScreenContainer2024>
  );
};

export default PointsScreen;
