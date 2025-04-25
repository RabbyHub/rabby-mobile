import { RootNames } from '@/constant/layout';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { useNavigationState } from '@react-navigation/native';
import { View } from 'react-native';

export const BatchRevokeScreen = () => {
  const params = useNavigationState(state => {
    const route = state.routes[state.index];
    if (route.name === RootNames.BatchRevoke) {
      return route.params as TransactionNavigatorParamList['BatchRevoke'];
    }
  });

  console.log(params);

  return <View />;
};
