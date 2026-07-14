import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { Extrapolation } from 'react-native-reanimated';
import Sortable, {
  type DragStartParams,
  type SortableGridDragEndParams,
  type SortableGridProps,
  type SortableGridRenderItem,
} from 'react-native-sortables';
import { trigger } from 'react-native-haptic-feedback';

import { IS_ANDROID } from '@/core/native/utils';
import type { KeyringAccountWithAlias } from '@/hooks/account';

import { WhiteListItemInSheetModal } from './WhiteListItem';

type SortableWhitelistItem = {
  account: KeyringAccountWithAlias;
  key: string;
};

type Props = {
  accounts: KeyringAccountWithAlias[];
  myAccounts: KeyringAccountWithAlias[];
  onReorder: (addresses: string[]) => Promise<boolean>;
  onSelect?: (account: KeyringAccountWithAlias) => void;
  scrollableRef: NonNullable<
    SortableGridProps<SortableWhitelistItem>['scrollableRef']
  >;
};

export function SortableWhitelistSection({
  accounts,
  myAccounts,
  onReorder,
  onSelect,
  scrollableRef,
}: Props) {
  const [activeItemKey, setActiveItemKey] = useState<string | null>(null);
  const [sortRevision, setSortRevision] = useState(0);
  const isDraggingRef = useRef(false);
  const isMountedRef = useRef(true);
  const suppressPressRef = useRef(false);
  const resetPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addressKeys = useMemo(
    () => accounts.map(account => account.address.toLowerCase()),
    [accounts],
  );
  const hasUniqueAddresses = new Set(addressKeys).size === addressKeys.length;
  const canSort = accounts.length > 1 && hasUniqueAddresses;
  const sortableItems = useMemo<SortableWhitelistItem[]>(
    () =>
      accounts.map((account, index) => ({
        account,
        key: hasUniqueAddresses
          ? addressKeys[index]
          : `${addressKeys[index]}-${index}`,
      })),
    [accounts, addressKeys, hasUniqueAddresses],
  );
  const importedAddressSet = useMemo(
    () => new Set(myAccounts.map(account => account.address.toLowerCase())),
    [myAccounts],
  );

  const resetPressSuppression = useCallback(() => {
    if (resetPressTimerRef.current) {
      clearTimeout(resetPressTimerRef.current);
    }
    resetPressTimerRef.current = setTimeout(() => {
      suppressPressRef.current = false;
      resetPressTimerRef.current = null;
    }, 0);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (resetPressTimerRef.current) {
        clearTimeout(resetPressTimerRef.current);
      }
    };
  }, []);

  const handleDragStart = useCallback(({ key }: DragStartParams) => {
    suppressPressRef.current = true;
    isDraggingRef.current = true;
    setActiveItemKey(key);
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  }, []);

  const handleDragEnd = useCallback(
    ({
      data,
      fromIndex,
      toIndex,
    }: SortableGridDragEndParams<SortableWhitelistItem>) => {
      isDraggingRef.current = false;
      setActiveItemKey(null);

      if (fromIndex !== toIndex) {
        const nextAddresses = data.map(item =>
          item.account.address.toLowerCase(),
        );
        onReorder(nextAddresses)
          .then(succeeded => {
            if (!succeeded && isMountedRef.current) {
              setSortRevision(current => current + 1);
            }
          })
          .catch(() => {
            if (isMountedRef.current) {
              setSortRevision(current => current + 1);
            }
          });
      }

      resetPressSuppression();
    },
    [onReorder, resetPressSuppression],
  );

  const handleSelect = useCallback(
    (account: KeyringAccountWithAlias) => {
      if (isDraggingRef.current || suppressPressRef.current) {
        return;
      }
      onSelect?.(account);
    },
    [onSelect],
  );

  const renderItem = useCallback<SortableGridRenderItem<SortableWhitelistItem>>(
    ({ item }) => (
      <View style={styles.item}>
        <WhiteListItemInSheetModal
          account={item.account}
          enableMenu
          hideBalance
          inWhiteList
          interactionDisabled={activeItemKey !== null}
          isActiveDragging={activeItemKey === item.key}
          isMyImported={importedAddressSet.has(
            item.account.address.toLowerCase(),
          )}
          sortable
          onPress={() => handleSelect(item.account)}
        />
      </View>
    ),
    [activeItemKey, handleSelect, importedAddressSet],
  );

  return (
    <View style={styles.container}>
      <Sortable.Grid
        key={sortRevision}
        activeItemScale={1}
        activeItemShadowOpacity={0.16}
        activationAnimationDuration={160}
        autoScrollActivationOffset={[56, 72]}
        autoScrollEnabled={canSort}
        autoScrollExtrapolation={Extrapolation.CLAMP}
        autoScrollMaxOverscroll={[0, 50]}
        autoScrollMaxVelocity={750}
        bringToFrontWhenActive
        columns={1}
        customHandle
        data={sortableItems}
        dragActivationDelay={IS_ANDROID ? 350 : 200}
        dragActivationFailOffset={8}
        dropAnimationDuration={200}
        inactiveItemOpacity={1}
        keyExtractor={item => item.key}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        overDrag="none"
        renderItem={renderItem}
        rowGap={12}
        scrollableRef={scrollableRef}
        sortEnabled={canSort}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    width: '100%',
  },
  item: {
    borderRadius: 16,
    width: '100%',
  },
});
