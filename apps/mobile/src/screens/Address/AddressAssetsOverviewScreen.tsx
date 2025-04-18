import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressListScreenContainer } from './components/AddressListScreenContainer';
import { MultiAssets } from './components/MultiAssets';

export function AddressAssetsOverview(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  return (
    <AddressListScreenContainer style={styles.screen}>
      <MultiAssets />
      {/* <FlatList
        ListEmptyComponent={AddressEmptyContainer}
      /> */}
    </AddressListScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-0'],
  },
  chart: {
    // paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headline: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  headlineText: {
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  itemGap: {
    marginBottom: 12,
  },
  footer: {
    marginTop: 12,
  },
  footerCard: {
    backgroundColor: colors2024['neutral-bg-2'],
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
  sectionFooter: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    marginTop: 2,
  },
  footerGap: {
    height: 70,
  },
}));
