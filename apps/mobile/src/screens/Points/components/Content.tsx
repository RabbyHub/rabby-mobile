import { useGetAppThemeMode, useThemeColors } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  Tabs,
  MaterialTabBar,
  MaterialTabItem,
  CollapsibleProps,
} from 'react-native-collapsible-tab-view';
import { ClaimItem, ClaimLoading } from './ClaimItem';
import { TopUserItem } from './TopBoard';
import { Text } from 'react-native';

export const PointsContent = ({
  activities,
  claimItem,
  claimItemLoading,
  claimedIds,
  topUsers,
  userPointsDetail,
  currentUserIdx,
  renderHeader,
  activitiesLoading,
  pointsEnded,
}: {
  claimItem: (campaign_id: number, points: number) => void;
  claimItemLoading: Record<number, boolean>;
  claimedIds: number[];
  userPointsDetail?: {
    id: string;
    logo_url: string;
    logo_thumbnail_url: string;
    web3_id: string;
    claimed_points: number;
  };
  topUsers?:
    | {
        id: string;
        logo_url: string;
        logo_thumbnail_url: string;
        web3_id: string;
        claimed_points: number;
      }[];
  activities?: {
    id: number;
    title: string;
    description: string;
    start_at: number;
    end_at: number;
    claimable_points: number;
  }[];
  currentUserIdx: number;
  renderHeader: CollapsibleProps['renderHeader'];
  activitiesLoading: boolean;
  pointsEnded?: boolean;
}) => {
  const theme = useGetAppThemeMode();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          // backgroundColor: colors['neutral-bg-1'],
        },
        tabBarWrap: {
          backgroundColor: colors['neutral-bg-1'],
          shadowColor: 'transparent',
          borderColor: colors['neutral-line'],
          borderWidth: StyleSheet.hairlineWidth,
        },
        tabBar: {
          height: 36,
        },
        label: {
          fontSize: 16,
          fontWeight: '500',
          textTransform: 'none',
        },
        indicator: {
          backgroundColor: colors['blue-default'],
          height: 2,
        },
        tabBarIndicator: {
          flexDirection: 'row',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        rankContainer: {
          flex: 1,
          position: 'relative',
        },
        rankContentContainerStyle: {
          paddingBottom: 56,
        },
        currentRankContainer: {
          width: '100%',
          height: 56,
          position: 'absolute',
          left: 0,
          bottom: 0,
          backgroundColor: 'transparent',
        },
      }),
    [colors],
  );

  const renderTabItem = React.useCallback(
    (props: any) => (
      <MaterialTabItem {...props} android_ripple={null} inactiveOpacity={1} />
    ),
    [],
  );

  const renderTabBar = React.useCallback(
    (props: any) => (
      <MaterialTabBar
        {...props}
        scrollEnabled={false}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
        TabItemComponent={renderTabItem}
        activeColor={colors['blue-default']}
        inactiveColor={colors['neutral-body']}
        labelStyle={styles.label}
        indicatorContainerStyle={styles.tabBarIndicator}
        pressColor={{}}
      />
    ),
    [
      colors,
      renderTabItem,
      styles.indicator,
      styles.label,
      styles.tabBar,
      styles.tabBarIndicator,
    ],
  );

  console.log('pointsEnded', pointsEnded);

  return (
    <Tabs.Container
      containerStyle={styles.container}
      minHeaderHeight={6}
      renderTabBar={renderTabBar}
      headerContainerStyle={styles.tabBarWrap}
      renderHeader={renderHeader}>
      <Tabs.Tab label={t('page.rabbyPoints.earn-points')} name="earn">
        <Tabs.FlatList
          ListHeaderComponent={
            pointsEnded ? (
              <Text
                style={{
                  textAlign: 'center',
                  justifyContent: 'center',
                  margin: 20,
                  marginBottom: 0,
                  backgroundColor: colors['neutral-card2'],
                  paddingVertical: 12,
                  fontSize: 13,
                  color: colors['neutral-title-1'],
                  fontWeight: '500',
                  overflow: 'hidden',
                  borderRadius: 6,
                }}>
                {t('page.rabbyPoints.firstRoundEnded')}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={activitiesLoading ? ClaimLoading : undefined}
          renderItem={React.useCallback(
            ({ item }) => (
              <ClaimItem
                {...item}
                onClaim={claimItem}
                claimLoading={claimItemLoading[item.id]}
                key={item.id}
                claimable={
                  item.claimable_points > 0 && !claimedIds.includes(item.id)
                }
              />
            ),
            [claimItem, claimItemLoading, claimedIds],
          )}
          data={activities}
          keyExtractor={item => item.id + ''}
        />
      </Tabs.Tab>
      <Tabs.Tab label={t('page.rabbyPoints.top-100')} name="top100">
        <View style={styles.rankContainer}>
          <Tabs.FlatList
            data={topUsers}
            renderItem={React.useCallback(
              ({ item, index }) => (
                <TopUserItem {...item} index={index} />
              ),
              [],
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.rankContentContainerStyle}
          />
          <View key={theme} style={styles.currentRankContainer}>
            {topUsers &&
              userPointsDetail &&
              userPointsDetail.claimed_points !== null && (
                <TopUserItem
                  {...userPointsDetail}
                  index={currentUserIdx}
                  showCurrentUser
                />
              )}
          </View>
        </View>
      </Tabs.Tab>
    </Tabs.Container>
  );
};
