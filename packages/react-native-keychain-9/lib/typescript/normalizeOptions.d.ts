import type { AuthenticationPrompt, BaseOptions, GetOptions, SetOptions } from './types';
export declare const AUTH_PROMPT_DEFAULTS: AuthenticationPrompt;
export declare function normalizeStorageOptions(options: SetOptions | GetOptions): SetOptions;
export declare function normalizeServiceOption(serviceOrOptions?: string | BaseOptions): BaseOptions;
export declare function normalizeServerOption(serverOrOptions?: string | BaseOptions): BaseOptions;
export declare function normalizeOptions(serviceOrOptions?: string | SetOptions | GetOptions): SetOptions | GetOptions;
//# sourceMappingURL=normalizeOptions.d.ts.map