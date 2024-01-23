import React from 'react';
import clsx from 'clsx';
import { View, Text, StyleSheet } from 'react-native';

import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { OpenedDappItem } from '../../hooks/useDappView';
import { useThemeColors } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { useDapps } from '@/hooks/useDapps';
import { createGetStyles } from '@/utils/styles';

export function BottomSheetContent({
  openedDappItem,
  bottomNavBar,
  onPressCloseDapp,
}: {
  openedDappItem?: OpenedDappItem | null;
  bottomNavBar: React.ReactNode;
  onPressCloseDapp?: () => void;
}) {
  const colors = useThemeColors();

  const { updateFavorite } = useDapps();

  const styles = React.useMemo(() => {
    return getStyle(colors);
  }, [colors]);

  if (!openedDappItem) return null;

  return (
    <View>
      {openedDappItem?.maybeDappInfo && (
        <BottomSheetScrollView style={{ minHeight: 108 }}>
          <DappCardInWebViewNav
            data={openedDappItem.maybeDappInfo}
            onFavoritePress={dapp => {
              updateFavorite(dapp.origin, !dapp.isFavorite);
            }}
          />
        </BottomSheetScrollView>
      )}

      <View style={styles.container}>
        <View className="flex-shrink-0">{bottomNavBar}</View>
        <View className={clsx('flex-shrink-1 mt-[18] px-[20]')}>
          <Button
            onPress={onPressCloseDapp}
            title={
              <View className="flex-row items-center justify-center">
                <Text style={styles.textDisconnect}>Close Dapp</Text>
              </View>
            }
            style={styles.button}
            containerStyle={styles.buttonContainer}
          />
        </View>
      </View>
    </View>
  );
}

const getStyle = createGetStyles(colors => ({
  container: {
    paddingVertical: 16,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: 1,
    justifyContent: 'center',
  },
  button: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    flexGrow: 1,
    display: 'flex',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors['neutral-line'],
    borderWidth: 1,
    borderRadius: 6,
  },
  textDisconnect: {
    color: colors['neutral-body'],
    fontSize: 16,
    fontWeight: '500',
  },
}));
