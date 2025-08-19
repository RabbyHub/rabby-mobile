import React from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';

import { RcSearchCC } from '@/assets/icons/common';
import { RcIconArrowTopLeftCC } from '@/assets2024/icons/browser';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useRequest } from 'ahooks';
import { ScrollView } from 'react-native-gesture-handler';

export function BrowserSearchAutoComplete({
  text,
  onSelect,
}: {
  text?: string;
  onSelect?(text: string): void;
}) {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const { data } = useRequest(
    async () => {
      if (!text) {
        return;
      }
      return openapi.searchDapp({
        q: text,
        match_id: true,
        start: 0,
        limit: 10,
      });
    },
    {
      refreshDeps: [text],
      onError(e) {
        console.log(e);
      },
      debounceWait: 300,
    },
  );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      onStartShouldSetResponder={() => {
        Keyboard.dismiss();
        return false;
      }}>
      {data?.dapps
        ?.filter(item => !!item.name)
        .slice(0, 1)
        ?.map(item => {
          return (
            <TouchableOpacity
              key={item.id}
              hitSlop={24}
              onPress={() => {
                onSelect?.(item.name);
              }}>
              <View style={styles.listItem}>
                <RcSearchCC
                  width={16}
                  height={16}
                  color={colors2024['neutral-foot']}
                />
                <Text
                  style={styles.listItemText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.name}
                </Text>
                <RcIconArrowTopLeftCC
                  width={24}
                  height={24}
                  color={colors2024['neutral-body']}
                />
              </View>
            </TouchableOpacity>
          );
        })}
    </ScrollView>
  );
}
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {},
  list: {
    flex: 1,
    paddingHorizontal: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    paddingTop: 16,
    backgroundColor: colors2024['neutral-bg-0'],
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemText: {
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
}));
