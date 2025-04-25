import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { RootNames } from '@/constant/layout';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { useNavigationState } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList } from 'react-native';
import { ListItem } from './ListItem';
import { ListHeader } from './ListHeader';
import { useBatchRevokeTask } from './useBatchRevokeTask';

export const BatchRevokeScreen = () => {
  const { t } = useTranslation();
  const task = useBatchRevokeTask();
  const params = useNavigationState(state => {
    const route = state.routes[state.index];
    if (route.name === RootNames.BatchRevoke) {
      return route.params as TransactionNavigatorParamList['BatchRevoke'];
    }
  });

  const { dataSource, revokeList } = params ?? {
    dataSource: [],
    revokeList: [],
  };

  React.useEffect(() => {
    task.init(dataSource, revokeList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource, revokeList]);

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
      <FlatList
        ListHeaderComponent={ListHeader}
        data={task.list}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={ListItem}
      />
    </FooterButtonScreenContainer>
  );
};
