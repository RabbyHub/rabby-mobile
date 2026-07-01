import React from 'react';
/**
 * Typically used internally, but if you want to mix lazy and regular screens you can wrap the lazy ones with this component.
 */
export declare const Lazy: React.FC<{
    /**
     * Whether to cancel the lazy fade in animation. Defaults to false.
     */
    cancelLazyFadeIn?: boolean;
    /**
     * How long to wait before mounting the children.
     */
    mountDelayMs?: number;
    /**
     * Whether to start mounted. Defaults to true if we are the focused tab.
     */
    startMounted?: boolean;
    children: React.ReactElement;
}>;
