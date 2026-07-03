import type { FlashListProps, FlashList as SPFlashList } from '@shopify/flash-list';
import React from 'react';
/**
 * Use like a regular FlashList.
 */
export declare const FlashList: <T>(p: FlashListProps<T> & {
    ref?: ((instance: SPFlashList<T> | null) => void) | React.RefObject<SPFlashList<T>> | null | undefined;
}) => React.ReactElement;
