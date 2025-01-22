import React from 'react';
import { Text, TextProps } from 'react-native';

import { useSQLiteStatics } from '@/databases/hooks/_statics';
import useInterval from 'react-use/lib/useInterval';

export function AppCacheSizeText(props: TextProps) {
  const { semanticBytes, fetchSqliteStatics } = useSQLiteStatics({
    enableAutoFetch: true,
  });

  useInterval(
    () => {
      // console.debug('[AppCacheSizeText] will fetchSqliteStatics');
      fetchSqliteStatics();
    },
    __DEV__ ? 5 * 1e3 : 30 * 1e3,
  );

  return <Text {...props}>{semanticBytes}</Text>;
}
