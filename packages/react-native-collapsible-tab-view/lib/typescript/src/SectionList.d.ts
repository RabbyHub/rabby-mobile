import React from 'react';
import { SectionList as RNSectionList, SectionListProps } from 'react-native';
/**
 * Use like a regular SectionList.
 */
export declare const SectionList: <T>(p: SectionListProps<T, import("react-native/types").DefaultSectionT> & {
    ref?: ((instance: RNSectionList<T, import("react-native/types").DefaultSectionT> | null) => void) | React.RefObject<RNSectionList<T, import("react-native/types").DefaultSectionT>> | null | undefined;
}) => React.ReactElement;
