import React from 'react';
import { FlatList as RNFlatList, FlatListProps } from 'react-native';
/**
 * Use like a regular FlatList.
 */
export declare const FlatList: <T>(p: FlatListProps<T> & {
    ref?: ((instance: RNFlatList<T> | null) => void) | React.RefObject<RNFlatList<T>> | null | undefined;
}) => React.ReactElement;
