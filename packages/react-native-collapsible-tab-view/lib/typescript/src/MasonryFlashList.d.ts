import { MasonryFlashListProps, MasonryFlashListRef } from '@shopify/flash-list';
import React from 'react';
declare type MasonryFlashListMemoRef = MasonryFlashListRef<any>;
/**
 * Use like a regular MasonryFlashList.
 */
export declare const MasonryFlashList: <T>(p: MasonryFlashListProps<T> & {
    ref?: ((instance: MasonryFlashListMemoRef | null) => void) | React.RefObject<MasonryFlashListMemoRef> | null | undefined;
}) => React.ReactElement;
export {};
