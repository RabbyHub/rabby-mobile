import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

import { OpenedDappItem } from '../../hooks/useDappView';
import { useThemeColors } from '@/hooks/theme';
import { DappCardInWebViewNav } from '../../components/DappCardInWebViewNav';
import { Button } from '@/components';
import { RcIconDisconnect } from '@/assets/icons/dapp';
import { useDapps } from '@/hooks/useDapps';
import { toast } from '@/components/Toast';
import clsx from 'clsx';
import { createGetStyles } from '@/utils/styles';

export function BottomSheetContent({
  dappInfo,
  bottomNavBar,
}: {
  dappInfo?: OpenedDappItem | null;
  bottomNavBar: React.ReactNode;
}) {
  const colors = useThemeColors();

  const { disconnectDapp, isDappConnected } = useDapps();

  const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);

  const styles = React.useMemo(() => {
    return getStyle(colors);
  }, [colors]);

  if (!dappInfo) return null;

  return (
    <View>
      {dappInfo?.maybeDappInfo && (
        <BottomSheetScrollView style={{ minHeight: 108 }}>
          <DappCardInWebViewNav data={dappInfo.maybeDappInfo} />
        </BottomSheetScrollView>
      )}

      <View style={styles.container}>
        <View className="flex-shrink-0">{bottomNavBar}</View>
        <View
          className={clsx(
            'flex-shrink-1 mt-[18] px-[20]',
            !isConnected && 'hidden',
          )}>
          <Button
            onPress={() => {
              disconnectDapp(dappInfo.origin);
              toast.success('Disconnected');
            }}
            title={
              <View className="flex-row items-center justify-center">
                <RcIconDisconnect width={20} height={20} className="mr-[6]" />
                <Text style={styles.textDisconnect}>Disconnect</Text>
              </View>
            }
            style={styles.button}
            containerStyle={styles.buttonContainer}
            titleStyle={styles.buttonTitle}
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
    borderBlockColor: colors['red-default'],
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
  buttonTitle: {
    color: colors['red-default'],
  },
  textDisconnect: {
    color: colors['red-default'],
    fontSize: 16,
    fontWeight: '500',
  },
}));
