type MkdirOptions = {
  NSURLIsExcludedFromBackupKey?: boolean; // iOS only
  NSFileProtectionKey?: string; // IOS only
};

type FileOptions = {
  NSFileProtectionKey?: string; // IOS only
};

export type NativeFSPersistFileOptions = {
  mode?: 'copy' | 'move';
  overwrite?: boolean;
  ensureParent?: boolean;
  NSURLIsExcludedFromBackupKey?: boolean;
  excludeFromBackup?: boolean;
  NSFileProtectionKey?: string;
};

export type NativeFSPersistFileResult = {
  sourcePath: string;
  targetPath: string;
  mode: 'copy' | 'move';
  bytesWritten: number;
  durationMs: number;
};

type ReadDirItem = {
  ctime: Date | undefined; // The creation date of the file (iOS only)
  mtime: Date | undefined; // The last modified date of the file
  name: string; // The name of the item
  path: string; // The absolute path to the item
  size: number; // Size in bytes
  isFile: () => boolean; // Is the file just a file?
  isDirectory: () => boolean; // Is the file a directory?
};

type StatResult = {
  name: string | undefined; // The name of the item TODO: why is this not documented?
  path: string; // The absolute path to the item
  size: number; // Size in bytes
  mode: number; // UNIX file mode
  ctime: number; // Created date
  mtime: number; // Last modified date
  originalFilepath: string; // In case of content uri this is the pointed file path, otherwise is the same as path
  isFile: () => boolean; // Is the file just a file?
  isDirectory: () => boolean; // Is the file a directory?
};

type Headers = { [name: string]: string };
type Fields = { [name: string]: string };

type DownloadFileOptions = {
  fromUrl: string; // URL to download file from
  toFile: string; // Local filesystem path to save the file to
  headers?: Headers; // An object of headers to be passed to the server
  background?: boolean; // Continue the download in the background after the app terminates (iOS only)
  discretionary?: boolean; // Allow the OS to control the timing and speed of the download to improve perceived performance  (iOS only)
  cacheable?: boolean; // Whether the download can be stored in the shared NSURLCache (iOS only)
  progressInterval?: number;
  progressDivider?: number;
  begin?: (res: DownloadBeginCallbackResult) => void;
  progress?: (res: DownloadProgressCallbackResult) => void;
  resumable?: () => void; // only supported on iOS yet
  connectionTimeout?: number; // only supported on Android yet
  readTimeout?: number; // supported on Android and iOS
  backgroundTimeout?: number; // Maximum time (in milliseconds) to download an entire resource (iOS only, useful for timing out background downloads)
};

type DownloadBeginCallbackResult = {
  jobId: number; // The download job ID, required if one wishes to cancel the download. See `stopDownload`.
  statusCode: number; // The HTTP status code
  contentLength: number; // The total size in bytes of the download resource
  headers: Headers; // The HTTP response headers from the server
};

type DownloadProgressCallbackResult = {
  jobId: number; // The download job ID, required if one wishes to cancel the download. See `stopDownload`.
  contentLength: number; // The total size in bytes of the download resource
  bytesWritten: number; // The number of bytes written to the file so far
};

type DownloadResult = {
  jobId: number; // The download job ID, required if one wishes to cancel the download. See `stopDownload`.
  statusCode: number; // The HTTP status code
  bytesWritten: number; // The number of bytes written to the file
};

type UploadFileOptions = {
  toUrl: string; // URL to upload file to
  binaryStreamOnly?: boolean; // Allow for binary data stream for file to be uploaded without extra headers, Default is 'false'
  files: UploadFileItem[]; // An array of objects with the file information to be uploaded.
  headers?: Headers; // An object of headers to be passed to the server
  fields?: Fields; // An object of fields to be passed to the server
  method?: string; // Default is 'POST', supports 'POST' and 'PUT'
  beginCallback?: (res: UploadBeginCallbackResult) => void; // deprecated
  progressCallback?: (res: UploadProgressCallbackResult) => void; // deprecated
  begin?: (res: UploadBeginCallbackResult) => void;
  progress?: (res: UploadProgressCallbackResult) => void;
};

type UploadFileItem = {
  name: string; // Name of the file, if not defined then filename is used
  filename: string; // Name of file
  filepath: string; // Path to file
  filetype: string; // The mimetype of the file to be uploaded, if not defined it will get mimetype from `filepath` extension
};

type UploadBeginCallbackResult = {
  jobId: number; // The upload job ID, required if one wishes to cancel the upload. See `stopUpload`.
};

type UploadProgressCallbackResult = {
  jobId: number; // The upload job ID, required if one wishes to cancel the upload. See `stopUpload`.
  totalBytesExpectedToSend: number; // The total number of bytes that will be sent to the server
  totalBytesSent: number; // The number of bytes sent to the server
};

type UploadResult = {
  jobId: number; // The upload job ID, required if one wishes to cancel the upload. See `stopUpload`.
  statusCode: number; // The HTTP status code
  headers: Headers; // The HTTP response headers from the server
  body: string; // The HTTP response body
};

type FSInfoResult = {
  totalSpace: number; // The total amount of storage space on the device (in bytes).
  freeSpace: number; // The amount of available storage space on the device (in bytes).
};

type ByteInput = Uint8Array | ArrayBuffer;

export type NativeFSWriteStreamOptions = {
  bufferSize?: number;
  bufferCount?: number;
};

export type NativeFSWriteStreamStats = {
  writerId: number;
  path: string;
  bufferSize: number;
  bufferCount: number;
  freeBuffers: number;
  acquiredBuffers: number;
  pendingBuffers?: number;
  bytesWritten: number;
  commits: number;
  closed: boolean;
};

export type NativeFSWriteStream = {
  acquireBuffer(): Uint8Array;
  commit(buffer: Uint8Array, byteLength?: number): number;
  close(): void;
  stats(): NativeFSWriteStreamStats;
};

export type NativeFSAsyncWriteStreamStats = NativeFSWriteStreamStats & {
  pendingBuffers: number;
};

export type NativeFSAsyncWriteStream = {
  acquireBuffer(): Uint8Array;
  commit(buffer: Uint8Array, byteLength?: number): Promise<number>;
  commitBatch(buffers: Uint8Array[], byteLengths?: number[]): Promise<number>;
  close(): Promise<NativeFSAsyncWriteStreamStats>;
  stats(): NativeFSAsyncWriteStreamStats;
};

export type NativeFSAsyncReadStreamOptions = {
  bufferSize?: number;
};

export type NativeFSAsyncReadStreamStats = {
  readerId: number;
  path: string;
  bufferSize: number;
  bytesRead: number;
  reads: number;
  closed: boolean;
  eof: boolean;
};

export type NativeFSAsyncReadStream = {
  readChunk(byteLength?: number): Promise<Uint8Array | null>;
  readBatch(byteLength?: number): Promise<Uint8Array | null>;
  close(): Promise<NativeFSAsyncReadStreamStats>;
  stats(): NativeFSAsyncReadStreamStats;
};

export type NativeFSZipArchiveEntry = {
  sourcePath: string;
  archivePath: string;
  size?: number;
  mtimeMs?: number;
};

export type NativeFSZipArchiveOptions = {
  compressionLevel?: number;
};

export type NativeFSZipEntryExtractionOptions = {
  entryName?: string;
  entryNameSuffix?: string;
};

export type NativeFSZipEntryListingOptions = {
  entryNameSuffix?: string;
  includeDirectories?: boolean;
  limit?: number;
};

export type NativeFSZipArchiveResult = {
  targetPath: string;
  entries: number;
  bytesRead: number;
  bytesWritten: number;
  durationMs: number;
};

export type NativeFSZipEntryExtractionResult = {
  archivePath: string;
  targetPath: string;
  entryName: string;
  bytesWritten: number;
  durationMs: number;
};

export type NativeFSZipEntryInfo = {
  entryName: string;
  directory: boolean;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  method: number;
  mtimeMs?: number;
};

export type NativeFSZipEntryListingResult = {
  archivePath: string;
  entries: NativeFSZipEntryInfo[];
  totalEntries: number;
  totalBytes: number;
  durationMs: number;
};

export type OwnedWriteStreamStatsForTest = NativeFSWriteStreamStats;
export type OwnedWriteStreamForTest = NativeFSWriteStream;

export type NativeFSDiagnosticEvent = {
  id: number;
  category: string;
  operation: string;
  pathTail: string;
  bytes: number;
  durationUs: number;
  tid: number;
  isError: boolean;
  message: string;
};

export type SafeSvgVariant = 'thumbnail' | 'detail';
export type SafeSvgResult =
  | {
      status: 'ready';
      uri: string;
      width: number;
      height: number;
      cacheHit: boolean;
    }
  | {
      status: 'failed';
      reason: string;
    };

export function installJSI(): boolean;
export function isJSIAvailable(): boolean;
export function isSafeSvgRasterizationAvailable(): boolean;
export function resolveSvg(options: {
  url: string;
  variant?: SafeSvgVariant;
}): Promise<SafeSvgResult>;
export function clearSafeSvgCache(): Promise<void>;
export function readFileBytes(filepath: string): Uint8Array;
export function readBytes(
  filepath: string,
  length?: number,
  position?: number,
): Uint8Array;
export function writeFileBytes(filepath: string, contents: ByteInput): void;
export function appendFileBytes(filepath: string, contents: ByteInput): void;
export function writeBytes(
  filepath: string,
  contents: ByteInput,
  position?: number,
): void;
export function createWriteStream(
  filepath: string,
  options?: NativeFSWriteStreamOptions,
): NativeFSWriteStream;
export function createWriteStream(
  filepath: string,
  bufferSize?: number,
  bufferCount?: number,
): NativeFSWriteStream;
export function createOwnedWriteStreamForTest(
  filepath: string,
  bufferSize?: number,
  bufferCount?: number,
): OwnedWriteStreamForTest;
export function isNativeAsyncFileIOAvailable(): boolean;
export function createAsyncWriteStream(
  filepath: string,
  options?: NativeFSWriteStreamOptions,
): NativeFSAsyncWriteStream;
export function createAsyncWriteStream(
  filepath: string,
  bufferSize?: number,
  bufferCount?: number,
): NativeFSAsyncWriteStream;
export function createAsyncReadStream(
  filepath: string,
  options?: NativeFSAsyncReadStreamOptions,
): NativeFSAsyncReadStream;
export function createAsyncReadStream(
  filepath: string,
  bufferSize?: number,
): NativeFSAsyncReadStream;
export function isNativeZipArchiveAvailable(): boolean;
export function isNativeZipEntryExtractionAvailable(): boolean;
export function isNativeZipEntryListingAvailable(): boolean;
export function createZipArchive(
  targetPath: string,
  entries: NativeFSZipArchiveEntry[],
  options?: NativeFSZipArchiveOptions,
): Promise<NativeFSZipArchiveResult>;
export function extractZipEntry(
  archivePath: string,
  targetPath: string,
  options?: NativeFSZipEntryExtractionOptions,
): Promise<NativeFSZipEntryExtractionResult>;
export function listZipEntries(
  archivePath: string,
  options?: NativeFSZipEntryListingOptions,
): Promise<NativeFSZipEntryListingResult>;
export function getDiagnosticsSnapshot(): NativeFSDiagnosticEvent[];
export function clearDiagnostics(): void;
export function existsSync(filepath: string): boolean;

export function mkdir(filepath: string, options?: MkdirOptions): Promise<void>;
export function moveFile(
  filepath: string,
  destPath: string,
  options?: FileOptions,
): Promise<void>;
export function copyFile(
  filepath: string,
  destPath: string,
  options?: FileOptions,
): Promise<void>;
export function persistFile(
  sourceUri: string,
  targetPath: string,
  options?: NativeFSPersistFileOptions,
): Promise<NativeFSPersistFileResult>;
export function pathForBundle(bundleNamed: string): Promise<string>;
export function pathForGroup(groupName: string): Promise<string>;
export function getFSInfo(): Promise<FSInfoResult>;
export function getAllExternalFilesDirs(): Promise<string[]>;
export function unlink(filepath: string): Promise<void>;
export function exists(filepath: string): Promise<boolean>;

export function stopDownload(jobId: number): void;

export function resumeDownload(jobId: number): void;

export function isResumable(jobId: number): Promise<boolean>;

export function stopUpload(jobId: number): void;

export function completeHandlerIOS(jobId: number): void;

export function readDir(dirpath: string): Promise<ReadDirItem[]>;

/**
 * Android-only
 */
export function scanFile(path: string): Promise<string[]>;

/**
 * Android-only
 */
export function readDirAssets(dirpath: string): Promise<ReadDirItem[]>;

/**
 * Android-only
 */
export function existsAssets(filepath: string): Promise<boolean>;

/**
 * Android-only
 */
export function existsRes(filepath: string): Promise<boolean>;

/**
 * Node style version (lowercase d). Returns just the names
 */
export function readdir(dirpath: string): Promise<string[]>;

/**
 * Android-only
 */
export function setReadable(
  filepath: string,
  readable: boolean,
  ownerOnly: boolean,
): Promise<boolean>;

export function stat(filepath: string): Promise<StatResult>;

export function readFile(
  filepath: string,
  encodingOrOptions?: any,
): Promise<string>;
export function read(
  filepath: string,
  length?: number,
  position?: number,
  encodingOrOptions?: any,
): Promise<string>;

/**
 * Android only
 */
export function readFileAssets(
  filepath: string,
  encodingOrOptions?: any,
): Promise<string>;

/**
 * Android only
 */
export function readFileRes(
  filepath: string,
  encodingOrOptions?: any,
): Promise<string>;

export function hash(filepath: string, algorithm: string): Promise<string>;

/**
 * Android only
 */
export function copyFileAssets(
  filepath: string,
  destPath: string,
): Promise<void>;

/**
 * Android only
 */
export function copyFileRes(filepath: string, destPath: string): Promise<void>;

/**
 * iOS only
 * Copies fotos from asset-library (camera-roll) to a specific location
 * with a given width or height
 * @see: https://developer.apple.com/reference/photos/phimagemanager/1616964-requestimageforasset
 */
export function copyAssetsFileIOS(
  imageUri: string,
  destPath: string,
  width: number,
  height: number,
  scale?: number,
  compression?: number,
  resizeMode?: string,
): Promise<string>;

/**
 * iOS only
 * Copies fotos from asset-library (camera-roll) to a specific location
 * with a given width or height
 * @see: https://developer.apple.com/reference/photos/phimagemanager/1616964-requestimageforasset
 */
export function copyAssetsVideoIOS(
  imageUri: string,
  destPath: string,
): Promise<string>;

export function writeFile(
  filepath: string,
  contents: string,
  encodingOrOptions?: any,
): Promise<void>;

export function appendFile(
  filepath: string,
  contents: string,
  encodingOrOptions?: string,
): Promise<void>;

export function write(
  filepath: string,
  contents: string,
  position?: number,
  encodingOrOptions?: any,
): Promise<void>;

export function downloadFile(options: DownloadFileOptions): {
  jobId: number;
  promise: Promise<DownloadResult>;
};

export function uploadFiles(options: UploadFileOptions): {
  jobId: number;
  promise: Promise<UploadResult>;
};

export function touch(
  filepath: string,
  mtime?: Date,
  ctime?: Date,
): Promise<void>;

export const MainBundlePath: string;
export const CachesDirectoryPath: string;
export const ExternalCachesDirectoryPath: string;
export const DownloadDirectoryPath: string;
export const DocumentDirectoryPath: string;
export const ExternalDirectoryPath: string;
export const ExternalStorageDirectoryPath: string;
export const TemporaryDirectoryPath: string;
export const LibraryDirectoryPath: string;
export const PicturesDirectoryPath: string;
export const FileProtectionKeys: string;
