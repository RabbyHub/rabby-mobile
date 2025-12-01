import {
  FooterButtonContainer2024Props,
  FooterButtonScreenContainer,
} from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { RootNames } from '@/constant/layout';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { usePreventRemove, useRoute } from '@react-navigation/native';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Platform,
  View,
} from 'react-native';
import { ListItem } from './ListItem';
import { ListHeader } from './ListHeader';
import { useBatchRevokeTask } from './useBatchRevokeTask';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import {
  EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY,
  eventBus,
} from '@/utils/events';

const ItemSeparatorComponent = () => {
  const { styles } = useTheme2024({
    getStyle: getStyle,
  });

  return <View style={styles.spacer} />;
};

export const BatchRevokeScreen = () => {
  const { t } = useTranslation();
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'BatchRevoke'>
    >();
  const params = route.params;
  const { styles, colors2024 } = useTheme2024({
    getStyle: getStyle,
  });

  const { dataSource, revokeList, account } = params ?? {
    dataSource: [],
    revokeList: [],
  };

  const task = useBatchRevokeTask({ account: account! });

  React.useEffect(() => {
    if (task.status === 'idle') {
      task.init(dataSource, revokeList);
    }
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

  const { navigation } = useSafeSetNavigationOptions();

  const buttonProps = React.useMemo(() => {
    const processText = `  (${task.revokedApprovals}/${task.totalApprovals})`;
    switch (task.status) {
      case 'paused':
        return {
          children: null,
          buttonProps: {
            title: t('page.approvals.continueRevoke') + processText,
            onPress: () => task.continue(),
            buttonStyle: {
              borderRadius: 16,
              backgroundColor: colors2024['green-light-1'],
            },
            titleStyle: {
              color: colors2024['green-default'],
            },
          },
        } as FooterButtonContainer2024Props;
      case 'active':
        return {
          children: null,
          buttonProps: {
            title: t('page.approvals.pauseRevoke') + processText,
            onPress: () => task.pause(),
            buttonStyle: {
              borderRadius: 16,
              backgroundColor: colors2024['red-light-1'],
            },
            titleStyle: {
              color: colors2024['red-default'],
            },
          },
        } as FooterButtonContainer2024Props;
      case 'completed':
        return {
          children: null,
          buttonProps: {
            title: t('page.approvals.revokeCompleted') + processText,
            onPress: () => {
              navigation.canGoBack() && navigation.goBack();
            },
            buttonStyle: {
              borderRadius: 16,
            },
          },
        } as FooterButtonContainer2024Props;
      case 'idle':
      default:
        return {
          children: null,
          buttonProps: {
            title: t('page.approvals.startRevoke') + processText,
            onPress: () => task.start(),
            buttonStyle: {
              borderRadius: 16,
            },
          },
        } as FooterButtonContainer2024Props;
    }
  }, [colors2024, navigation, t, task]);

  const [accountDepositVisible, setAccountDepositVisible] =
    React.useState(false);

  usePreventRemove(
    task.status !== 'idle' &&
      task.status !== 'completed' &&
      !accountDepositVisible,
    e => {
      Alert.alert(
        t('page.approvals.stopTheRevokeProcess'),
        t('page.approvals.leavingThisPageWillStopTheRevokeProcess'),
        [
          {
            text: t('global.Cancel'),
            style: 'cancel',
            onPress: () => {},
          },
          {
            text: t('page.signTx.yes'),
            style: 'destructive',
            onPress: () => {
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    },
  );

  React.useEffect(() => {
    const listen = visible => {
      setAccountDepositVisible(visible);
      if (visible) {
        task.pause();
      } else {
        task.continue();
      }
    };

    eventBus.on(EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY, listen);

    return () => {
      eventBus.off(EVENT_PAY_GAS_BY_GAS_ACCOUNT_AND_NOT_CAN_PAY, listen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          navigation.goBack();
          return true;
        },
      );

      return () => backHandler.remove();
    }
  }, [navigation]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      task.pause();
      task.resetCurrent();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.resetCurrent]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        if (task.status === 'active') {
          task.pause();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [task]);

  if (!params) {
    return null;
  }

  return (
    <FooterButtonScreenContainer footerBottomOffset={56} {...buttonProps}>
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
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors2024['neutral-bg-1'],
    marginHorizontal: 16,
    marginBottom: 40,
  },
  spacer: {
    height: 16,
  },
}));
