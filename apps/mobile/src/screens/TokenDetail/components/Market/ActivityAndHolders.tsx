import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Activity from './Activity';
import Holder from './Holder';
import { useHolderInfo } from './hooks';

const enum TabKey {
  activity = 'activity',
  holders = 'holders',
}

const ActivityAndHolders = ({
  tokenId,
  chainId,
}: {
  tokenId: string;
  chainId: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(TabKey.activity);
  const { t } = useTranslation();

  const { summaryData, detailsData, isHolderEmpty } = useHolderInfo(
    tokenId,
    chainId,
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          style={[
            styles.headerText,
            activeTabKey === TabKey.activity && styles.activeText,
          ]}
          onPress={() => setActiveTabKey(TabKey.activity)}>
          {t('page.tokenDetail.marketInfo.activity')}
        </Text>
        <Text
          style={[
            styles.headerText,
            activeTabKey === TabKey.holders && styles.activeText,
          ]}
          onPress={() => setActiveTabKey(TabKey.holders)}>
          {t('page.tokenDetail.marketInfo.holders')}
        </Text>
      </View>
      <View style={styles.content}>
        {activeTabKey === TabKey.activity && (
          <Activity tokenId={tokenId} chainId={chainId} />
        )}
        {activeTabKey === TabKey.holders && (
          <Holder
            top10ratio={summaryData?.ratio_top10 || 0}
            top100ratio={summaryData?.ratio_top100 || 0}
            data={detailsData?.data_list || []}
            isEmpty={isHolderEmpty}
          />
        )}
      </View>
    </View>
  );
};

export default ActivityAndHolders;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    paddingHorizontal: 16,
  },
  header: {
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    marginTop: 12,
  },
  activityContent: {
    borderWidth: 1,
  },
}));
