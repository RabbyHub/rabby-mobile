import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { RootNames } from '@/constant/layout';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { useNavigationState } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { ListItem } from './ListItem';
import { ListHeader } from './ListHeader';
import { useBatchRevokeTask } from './useBatchRevokeTask';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

const ItemSeparatorComponent = () => {
  const { styles } = useTheme2024({
    getStyle: getStyle,
  });

  return <View style={styles.spacer} />;
};

export const BatchRevokeScreen = () => {
  const { t } = useTranslation();
  const task = useBatchRevokeTask();
  const params = useNavigationState(state => {
    const route = state.routes[state.index];
    if (route.name === RootNames.BatchRevoke) {
      return route.params as TransactionNavigatorParamList['BatchRevoke'];
    }
  });
  const { styles } = useTheme2024({
    getStyle: getStyle,
  });

  const { dataSource, revokeList } = params ?? {
    dataSource: [],
    revokeList: [],
  };

  React.useEffect(() => {
    task.init(dataSource, revokeList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, revokeList]);

  const isPaused = React.useMemo(() => {
    return task.status === 'paused';
  }, [task.status]);

  const extraData = React.useMemo(() => {
    return {
      isPaused,
    };
  }, [isPaused]);

  if (!params) {
    return null;
  }

  return (
    <FooterButtonScreenContainer
      footerBottomOffset={35}
      buttonProps={{
        title: t('page.approvals.startRevoke', {
          currentCount: task.revokedApprovals,
          totalCount: task.totalApprovals,
        }),
        buttonStyle: { borderRadius: 16 },
      }}>
      <View style={styles.root}>
        <ListHeader />
        <FlatList
          ListHeaderComponent={ItemSeparatorComponent}
          data={task.list}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          extraData={extraData}
          ItemSeparatorComponent={ItemSeparatorComponent}
          renderItem={({ item }) => (
            <ListItem
              item={item}
              isPaused={isPaused}
              onStillRevoke={record => {
                task.addRevokeTask(record, 0, true);
                task.continue();
              }}
            />
          )}
        />
      </View>
    </FooterButtonScreenContainer>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-1'],
    marginHorizontal: 16,
  },
  spacer: {
    height: 16,
  },
}));
