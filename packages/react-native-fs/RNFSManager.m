//
//  RNFSManager.m
//  RNFSManager
//
//  Created by Johannes Lumpe on 08/05/15.
//  Copyright (c) 2015 Johannes Lumpe. All rights reserved.
//

#import "RNFSManager.h"

#import "NSArray+Map.h"
#import "Downloader.h"
#import "ios/RNFSJsiInstaller.h"
#import "Uploader.h"

#import <React/RCTEventDispatcher.h>
#import <React/RCTUtils.h>

#if __has_include(<React/RCTImageLoader.h>)
#import <React/RCTImageLoader.h>
#else
#import <React/RCTImageLoaderProtocol.h>
#endif

#import <CommonCrypto/CommonDigest.h>
#import <Photos/Photos.h>
#import <zlib.h>


@interface RNFSManager()

@property (retain) NSMutableDictionary* downloaders;
@property (retain) NSMutableDictionary* uuids;
@property (retain) NSMutableDictionary* uploaders;

@end

@implementation RNFSManager

static NSMutableDictionary *completionHandlers;

static NSString * const RNFSZipErrorDomain = @"RNFSZip";
static const NSUInteger RNFSZipBufferSize = 256 * 1024;

static NSError *RNFSZipMakeError(NSString *message)
{
  return [NSError errorWithDomain:RNFSZipErrorDomain
                             code:1
                         userInfo:@{NSLocalizedDescriptionKey: message ?: @"ZIP operation failed"}];
}

static NSData *RNFSZipUTF8Data(NSString *value)
{
  return [value dataUsingEncoding:NSUTF8StringEncoding] ?: [NSData data];
}

static void RNFSZipAppendUInt16(NSMutableData *data, uint16_t value)
{
  uint8_t bytes[2] = {
    (uint8_t)(value & 0xff),
    (uint8_t)((value >> 8) & 0xff),
  };
  [data appendBytes:bytes length:sizeof(bytes)];
}

static void RNFSZipAppendUInt32(NSMutableData *data, uint32_t value)
{
  uint8_t bytes[4] = {
    (uint8_t)(value & 0xff),
    (uint8_t)((value >> 8) & 0xff),
    (uint8_t)((value >> 16) & 0xff),
    (uint8_t)((value >> 24) & 0xff),
  };
  [data appendBytes:bytes length:sizeof(bytes)];
}

static uint16_t RNFSZipReadUInt16(const uint8_t *bytes)
{
  return (uint16_t)bytes[0] | ((uint16_t)bytes[1] << 8);
}

static uint32_t RNFSZipReadUInt32(const uint8_t *bytes)
{
  return (uint32_t)bytes[0] |
    ((uint32_t)bytes[1] << 8) |
    ((uint32_t)bytes[2] << 16) |
    ((uint32_t)bytes[3] << 24);
}

static BOOL RNFSZipWriteData(NSFileHandle *file, NSData *data, NSError **error)
{
  @try {
    [file writeData:data];
    return YES;
  } @catch (NSException *exception) {
    if (error) {
      *error = RNFSZipMakeError(exception.reason ?: exception.name);
    }
    return NO;
  }
}

static BOOL RNFSZipWriteBytes(NSFileHandle *file, const void *bytes, NSUInteger length, NSError **error)
{
  NSData *data = [NSData dataWithBytes:bytes length:length];
  return RNFSZipWriteData(file, data, error);
}

static NSString *RNFSZipNormalizeEntryName(NSString *entryName, NSError **error)
{
  if (![entryName isKindOfClass:[NSString class]] || entryName.length == 0) {
    if (error) {
      *error = RNFSZipMakeError(@"Zip entry path is required");
    }
    return nil;
  }

  NSString *normalized = [entryName stringByReplacingOccurrencesOfString:@"\\" withString:@"/"];
  while ([normalized hasPrefix:@"/"]) {
    normalized = [normalized substringFromIndex:1];
  }

  NSMutableArray<NSString *> *parts = [NSMutableArray array];
  for (NSString *part in [normalized componentsSeparatedByString:@"/"]) {
    if (part.length == 0 || [part isEqualToString:@"."]) {
      continue;
    }
    if ([part isEqualToString:@".."]) {
      if (error) {
        *error = RNFSZipMakeError([NSString stringWithFormat:@"Zip entry path must not contain '..': %@", entryName]);
      }
      return nil;
    }
    [parts addObject:part];
  }

  if (parts.count == 0) {
    if (error) {
      *error = RNFSZipMakeError(@"Zip entry path is empty");
    }
    return nil;
  }

  return [parts componentsJoinedByString:@"/"];
}

static int RNFSZipCompressionLevel(NSDictionary *options)
{
  NSNumber *levelNumber = [options objectForKey:@"compressionLevel"];
  if (![levelNumber isKindOfClass:[NSNumber class]]) {
    return Z_DEFAULT_COMPRESSION;
  }

  int level = [levelNumber intValue];
  if (level < Z_NO_COMPRESSION) {
    return Z_NO_COMPRESSION;
  }
  if (level > Z_BEST_COMPRESSION) {
    return Z_BEST_COMPRESSION;
  }
  return level;
}

static void RNFSZipGetDosDateTime(NSDate *date, uint16_t *dosDate, uint16_t *dosTime)
{
  NSDate *nextDate = date ?: [NSDate date];
  NSCalendar *calendar = [NSCalendar currentCalendar];
  NSDateComponents *components = [calendar components:NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay | NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond
                                             fromDate:nextDate];
  NSInteger year = MIN(MAX(components.year, 1980), 2107);
  NSInteger month = MIN(MAX(components.month, 1), 12);
  NSInteger day = MIN(MAX(components.day, 1), 31);
  NSInteger hour = MIN(MAX(components.hour, 0), 23);
  NSInteger minute = MIN(MAX(components.minute, 0), 59);
  NSInteger second = MIN(MAX(components.second, 0), 59);

  *dosDate = (uint16_t)(((year - 1980) << 9) | (month << 5) | day);
  *dosTime = (uint16_t)((hour << 11) | (minute << 5) | (second / 2));
}

static NSMutableData *RNFSZipLocalHeader(NSData *nameData, uint16_t dosDate, uint16_t dosTime)
{
  NSMutableData *header = [NSMutableData dataWithCapacity:30 + nameData.length];
  RNFSZipAppendUInt32(header, 0x04034b50);
  RNFSZipAppendUInt16(header, 20);
  RNFSZipAppendUInt16(header, 0x0008);
  RNFSZipAppendUInt16(header, 8);
  RNFSZipAppendUInt16(header, dosTime);
  RNFSZipAppendUInt16(header, dosDate);
  RNFSZipAppendUInt32(header, 0);
  RNFSZipAppendUInt32(header, 0);
  RNFSZipAppendUInt32(header, 0);
  RNFSZipAppendUInt16(header, (uint16_t)nameData.length);
  RNFSZipAppendUInt16(header, 0);
  [header appendData:nameData];
  return header;
}

static NSMutableData *RNFSZipDataDescriptor(uint32_t crcValue, uint32_t compressedSize, uint32_t uncompressedSize)
{
  NSMutableData *descriptor = [NSMutableData dataWithCapacity:16];
  RNFSZipAppendUInt32(descriptor, 0x08074b50);
  RNFSZipAppendUInt32(descriptor, crcValue);
  RNFSZipAppendUInt32(descriptor, compressedSize);
  RNFSZipAppendUInt32(descriptor, uncompressedSize);
  return descriptor;
}

static NSMutableData *RNFSZipCentralDirectoryHeader(NSData *nameData,
                                                   uint16_t dosDate,
                                                   uint16_t dosTime,
                                                   uint32_t crcValue,
                                                   uint32_t compressedSize,
                                                   uint32_t uncompressedSize,
                                                   uint32_t localHeaderOffset)
{
  NSMutableData *header = [NSMutableData dataWithCapacity:46 + nameData.length];
  RNFSZipAppendUInt32(header, 0x02014b50);
  RNFSZipAppendUInt16(header, 20);
  RNFSZipAppendUInt16(header, 20);
  RNFSZipAppendUInt16(header, 0x0008);
  RNFSZipAppendUInt16(header, 8);
  RNFSZipAppendUInt16(header, dosTime);
  RNFSZipAppendUInt16(header, dosDate);
  RNFSZipAppendUInt32(header, crcValue);
  RNFSZipAppendUInt32(header, compressedSize);
  RNFSZipAppendUInt32(header, uncompressedSize);
  RNFSZipAppendUInt16(header, (uint16_t)nameData.length);
  RNFSZipAppendUInt16(header, 0);
  RNFSZipAppendUInt16(header, 0);
  RNFSZipAppendUInt16(header, 0);
  RNFSZipAppendUInt16(header, 0);
  RNFSZipAppendUInt32(header, 0);
  RNFSZipAppendUInt32(header, localHeaderOffset);
  [header appendData:nameData];
  return header;
}

static NSMutableData *RNFSZipEndOfCentralDirectory(uint16_t entryCount,
                                                   uint32_t centralDirectorySize,
                                                   uint32_t centralDirectoryOffset)
{
  NSMutableData *header = [NSMutableData dataWithCapacity:22];
  RNFSZipAppendUInt32(header, 0x06054b50);
  RNFSZipAppendUInt16(header, 0);
  RNFSZipAppendUInt16(header, 0);
  RNFSZipAppendUInt16(header, entryCount);
  RNFSZipAppendUInt16(header, entryCount);
  RNFSZipAppendUInt32(header, centralDirectorySize);
  RNFSZipAppendUInt32(header, centralDirectoryOffset);
  RNFSZipAppendUInt16(header, 0);
  return header;
}

static BOOL RNFSZipDeflateFile(NSString *sourcePath,
                               NSFileHandle *zipFile,
                               int compressionLevel,
                               uint32_t *crcValue,
                               uint32_t *compressedSize,
                               uint32_t *uncompressedSize,
                               NSError **error)
{
  NSInputStream *inputStream = [NSInputStream inputStreamWithFileAtPath:sourcePath];
  [inputStream open];
  if (inputStream.streamStatus == NSStreamStatusError) {
    if (error) {
      *error = inputStream.streamError ?: RNFSZipMakeError([NSString stringWithFormat:@"Cannot open zip source file: %@", sourcePath]);
    }
    return NO;
  }

  z_stream stream;
  memset(&stream, 0, sizeof(stream));
  int zResult = deflateInit2(&stream, compressionLevel, Z_DEFLATED, -MAX_WBITS, 8, Z_DEFAULT_STRATEGY);
  if (zResult != Z_OK) {
    [inputStream close];
    if (error) {
      *error = RNFSZipMakeError([NSString stringWithFormat:@"deflateInit2 failed: %d", zResult]);
    }
    return NO;
  }

  uint8_t *inputBuffer = malloc(RNFSZipBufferSize);
  uint8_t *outputBuffer = malloc(RNFSZipBufferSize);
  if (!inputBuffer || !outputBuffer) {
    free(inputBuffer);
    free(outputBuffer);
    deflateEnd(&stream);
    [inputStream close];
    if (error) {
      *error = RNFSZipMakeError(@"Cannot allocate zip buffers");
    }
    return NO;
  }

  uLong crc = crc32(0L, Z_NULL, 0);
  uint64_t compressedTotal = 0;
  uint64_t uncompressedTotal = 0;
  BOOL success = YES;

  while (success) {
    NSInteger read = [inputStream read:inputBuffer maxLength:RNFSZipBufferSize];
    if (read < 0) {
      if (error) {
        *error = inputStream.streamError ?: RNFSZipMakeError([NSString stringWithFormat:@"Cannot read zip source file: %@", sourcePath]);
      }
      success = NO;
      break;
    }

    BOOL finishedInput = read == 0;
    if (read > 0) {
      crc = crc32(crc, inputBuffer, (uInt)read);
      uncompressedTotal += (uint64_t)read;
    }

    stream.next_in = inputBuffer;
    stream.avail_in = (uInt)read;

    int flush = finishedInput ? Z_FINISH : Z_NO_FLUSH;
    do {
      stream.next_out = outputBuffer;
      stream.avail_out = (uInt)RNFSZipBufferSize;
      zResult = deflate(&stream, flush);
      if (zResult == Z_STREAM_ERROR) {
        if (error) {
          *error = RNFSZipMakeError(@"deflate failed");
        }
        success = NO;
        break;
      }

      NSUInteger produced = RNFSZipBufferSize - stream.avail_out;
      if (produced > 0) {
        if (!RNFSZipWriteBytes(zipFile, outputBuffer, produced, error)) {
          success = NO;
          break;
        }
        compressedTotal += (uint64_t)produced;
      }
    } while (success && (stream.avail_out == 0 || (flush == Z_FINISH && zResult != Z_STREAM_END)));

    if (!success || finishedInput) {
      break;
    }
  }

  free(inputBuffer);
  free(outputBuffer);
  deflateEnd(&stream);
  [inputStream close];

  if (!success) {
    return NO;
  }
  if (compressedTotal > UINT32_MAX || uncompressedTotal > UINT32_MAX) {
    if (error) {
      *error = RNFSZipMakeError(@"Zip64 archives are not supported");
    }
    return NO;
  }

  *crcValue = (uint32_t)crc;
  *compressedSize = (uint32_t)compressedTotal;
  *uncompressedSize = (uint32_t)uncompressedTotal;
  return YES;
}

static NSDictionary *RNFSZipFindCentralDirectoryEntry(NSString *archivePath,
                                                     NSString *requestedEntryName,
                                                     NSString *entryNameSuffix,
                                                     NSError **error)
{
  NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:archivePath error:error];
  if (!attributes) {
    return nil;
  }

  unsigned long long archiveSize = [attributes[NSFileSize] unsignedLongLongValue];
  if (archiveSize < 22) {
    if (error) {
      *error = RNFSZipMakeError(@"Invalid zip archive: missing end record");
    }
    return nil;
  }

  NSFileHandle *file = [NSFileHandle fileHandleForReadingAtPath:archivePath];
  if (!file) {
    if (error) {
      *error = RNFSZipMakeError([NSString stringWithFormat:@"Cannot open zip archive: %@", archivePath]);
    }
    return nil;
  }

  unsigned long long tailLength = MIN(archiveSize, (unsigned long long)(22 + UINT16_MAX));
  [file seekToFileOffset:archiveSize - tailLength];
  NSData *tailData = [file readDataOfLength:(NSUInteger)tailLength];
  const uint8_t *tailBytes = tailData.bytes;
  NSInteger eocdOffset = -1;
  for (NSInteger offset = (NSInteger)tailData.length - 22; offset >= 0; offset--) {
    if (RNFSZipReadUInt32(tailBytes + offset) == 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    if (error) {
      *error = RNFSZipMakeError(@"Invalid zip archive: EOCD not found");
    }
    return nil;
  }

  uint16_t entryCount = RNFSZipReadUInt16(tailBytes + eocdOffset + 10);
  uint32_t centralDirectorySize = RNFSZipReadUInt32(tailBytes + eocdOffset + 12);
  uint32_t centralDirectoryOffset = RNFSZipReadUInt32(tailBytes + eocdOffset + 16);
  if ((uint64_t)centralDirectoryOffset + (uint64_t)centralDirectorySize > archiveSize) {
    if (error) {
      *error = RNFSZipMakeError(@"Invalid zip archive: central directory out of range");
    }
    return nil;
  }

  [file seekToFileOffset:centralDirectoryOffset];
  NSData *centralData = [file readDataOfLength:centralDirectorySize];
  const uint8_t *centralBytes = centralData.bytes;
  NSUInteger offset = 0;
  NSDictionary *selectedEntry = nil;

  for (uint16_t index = 0; index < entryCount && offset + 46 <= centralData.length; index++) {
    if (RNFSZipReadUInt32(centralBytes + offset) != 0x02014b50) {
      if (error) {
        *error = RNFSZipMakeError(@"Invalid zip archive: central directory record is malformed");
      }
      return nil;
    }

    uint16_t method = RNFSZipReadUInt16(centralBytes + offset + 10);
    uint32_t crcValue = RNFSZipReadUInt32(centralBytes + offset + 16);
    uint32_t compressedSize = RNFSZipReadUInt32(centralBytes + offset + 20);
    uint32_t uncompressedSize = RNFSZipReadUInt32(centralBytes + offset + 24);
    uint16_t nameLength = RNFSZipReadUInt16(centralBytes + offset + 28);
    uint16_t extraLength = RNFSZipReadUInt16(centralBytes + offset + 30);
    uint16_t commentLength = RNFSZipReadUInt16(centralBytes + offset + 32);
    uint32_t localHeaderOffset = RNFSZipReadUInt32(centralBytes + offset + 42);
    NSUInteger recordLength = 46 + nameLength + extraLength + commentLength;
    if (offset + recordLength > centralData.length) {
      if (error) {
        *error = RNFSZipMakeError(@"Invalid zip archive: central directory entry out of range");
      }
      return nil;
    }

    NSData *nameData = [centralData subdataWithRange:NSMakeRange(offset + 46, nameLength)];
    NSString *entryName = [[NSString alloc] initWithData:nameData encoding:NSUTF8StringEncoding];
    NSError *normalizeError = nil;
    NSString *normalizedName = RNFSZipNormalizeEntryName(entryName, &normalizeError);
    if (normalizedName) {
      BOOL matches = NO;
      if (requestedEntryName.length > 0) {
        matches = [normalizedName isEqualToString:requestedEntryName];
      } else if (entryNameSuffix.length > 0) {
        matches = [normalizedName hasSuffix:entryNameSuffix];
      } else {
        matches = YES;
      }

      if (matches) {
        if (!selectedEntry || [normalizedName compare:selectedEntry[@"entryName"]] == NSOrderedDescending) {
          selectedEntry = @{
            @"entryName": normalizedName,
            @"method": @(method),
            @"crc32": @(crcValue),
            @"compressedSize": @(compressedSize),
            @"uncompressedSize": @(uncompressedSize),
            @"localHeaderOffset": @(localHeaderOffset),
          };
        }
      }
    }

    offset += recordLength;
  }

  if (!selectedEntry && error) {
    *error = RNFSZipMakeError(@"Zip entry not found");
  }
  return selectedEntry;
}

static BOOL RNFSZipInflateEntry(NSString *archivePath,
                                NSDictionary *entry,
                                NSString *targetPath,
                                NSError **error)
{
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSString *parentPath = [targetPath stringByDeletingLastPathComponent];
  if (parentPath.length > 0) {
    [fileManager createDirectoryAtPath:parentPath withIntermediateDirectories:YES attributes:nil error:nil];
  }
  [fileManager createFileAtPath:targetPath contents:nil attributes:nil];

  NSFileHandle *archiveFile = [NSFileHandle fileHandleForReadingAtPath:archivePath];
  NSFileHandle *targetFile = [NSFileHandle fileHandleForWritingAtPath:targetPath];
  if (!archiveFile || !targetFile) {
    if (error) {
      *error = RNFSZipMakeError(@"Cannot open zip archive or extraction target");
    }
    return NO;
  }

  uint32_t localHeaderOffset = [entry[@"localHeaderOffset"] unsignedIntValue];
  [archiveFile seekToFileOffset:localHeaderOffset];
  NSData *localHeader = [archiveFile readDataOfLength:30];
  if (localHeader.length < 30 || RNFSZipReadUInt32(localHeader.bytes) != 0x04034b50) {
    if (error) {
      *error = RNFSZipMakeError(@"Invalid zip archive: local file header is malformed");
    }
    return NO;
  }

  const uint8_t *localBytes = localHeader.bytes;
  uint16_t nameLength = RNFSZipReadUInt16(localBytes + 26);
  uint16_t extraLength = RNFSZipReadUInt16(localBytes + 28);
  uint64_t dataOffset = (uint64_t)localHeaderOffset + 30 + nameLength + extraLength;
  uint32_t compressedSize = [entry[@"compressedSize"] unsignedIntValue];
  uint32_t expectedSize = [entry[@"uncompressedSize"] unsignedIntValue];
  uint32_t expectedCrc = [entry[@"crc32"] unsignedIntValue];
  uint16_t method = [entry[@"method"] unsignedShortValue];
  [archiveFile seekToFileOffset:dataOffset];

  uint8_t *outputBuffer = malloc(RNFSZipBufferSize);
  if (!outputBuffer) {
    free(outputBuffer);
    if (error) {
      *error = RNFSZipMakeError(@"Cannot allocate zip extraction buffers");
    }
    return NO;
  }

  uLong crc = crc32(0L, Z_NULL, 0);
  uint64_t remaining = compressedSize;
  uint64_t writtenTotal = 0;
  BOOL success = YES;

  if (method == 0) {
    while (success && remaining > 0) {
      NSUInteger nextRead = (NSUInteger)MIN((uint64_t)RNFSZipBufferSize, remaining);
      NSData *chunk = [archiveFile readDataOfLength:nextRead];
      if (chunk.length == 0) {
        if (error) {
          *error = RNFSZipMakeError(@"Unexpected end of zip entry");
        }
        success = NO;
        break;
      }
      crc = crc32(crc, chunk.bytes, (uInt)chunk.length);
      writtenTotal += chunk.length;
      remaining -= chunk.length;
      if (!RNFSZipWriteData(targetFile, chunk, error)) {
        success = NO;
      }
    }
  } else if (method == 8) {
    z_stream stream;
    memset(&stream, 0, sizeof(stream));
    int zResult = inflateInit2(&stream, -MAX_WBITS);
    if (zResult != Z_OK) {
      if (error) {
        *error = RNFSZipMakeError([NSString stringWithFormat:@"inflateInit2 failed: %d", zResult]);
      }
      success = NO;
    }

    while (success && remaining > 0) {
      NSUInteger nextRead = (NSUInteger)MIN((uint64_t)RNFSZipBufferSize, remaining);
      NSData *chunk = [archiveFile readDataOfLength:nextRead];
      if (chunk.length == 0) {
        if (error) {
          *error = RNFSZipMakeError(@"Unexpected end of zip entry");
        }
        success = NO;
        break;
      }

      remaining -= chunk.length;
      stream.next_in = (Bytef *)chunk.bytes;
      stream.avail_in = (uInt)chunk.length;

      do {
        stream.next_out = outputBuffer;
        stream.avail_out = (uInt)RNFSZipBufferSize;
        zResult = inflate(&stream, remaining == 0 ? Z_FINISH : Z_NO_FLUSH);
        if (zResult != Z_OK && zResult != Z_STREAM_END) {
          if (error) {
            *error = RNFSZipMakeError([NSString stringWithFormat:@"inflate failed: %d", zResult]);
          }
          success = NO;
          break;
        }

        NSUInteger produced = RNFSZipBufferSize - stream.avail_out;
        if (produced > 0) {
          crc = crc32(crc, outputBuffer, (uInt)produced);
          writtenTotal += produced;
          if (!RNFSZipWriteBytes(targetFile, outputBuffer, produced, error)) {
            success = NO;
            break;
          }
        }
      } while (success && stream.avail_out == 0);
    }

    inflateEnd(&stream);
  } else {
    if (error) {
      *error = RNFSZipMakeError([NSString stringWithFormat:@"Unsupported zip compression method: %u", method]);
    }
    success = NO;
  }

  free(outputBuffer);

  if (!success) {
    [fileManager removeItemAtPath:targetPath error:nil];
    return NO;
  }
  if (writtenTotal != expectedSize || (uint32_t)crc != expectedCrc) {
    [fileManager removeItemAtPath:targetPath error:nil];
    if (error) {
      *error = RNFSZipMakeError(@"Zip entry checksum or size mismatch");
    }
    return NO;
  }

  return YES;
}

RCT_EXPORT_MODULE();

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install)
{
  return @([RNFSJsiInstaller installWithBridge:self.bridge]);
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_queue_create("pe.lum.rnfs", DISPATCH_QUEUE_SERIAL);
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(readDir:(NSString *)dirPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSError *error = nil;

  NSArray *contents = [fileManager contentsOfDirectoryAtPath:dirPath error:&error];
  NSMutableArray *tagetContents = [[NSMutableArray alloc] init];
  for (NSString *obj in contents) {
    NSString *path = [dirPath stringByAppendingPathComponent:obj];
    NSDictionary *attributes = [fileManager attributesOfItemAtPath:path error:nil];
    if(attributes != nil) {
        [tagetContents addObject:@{
            @"ctime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileCreationDate]],
            @"mtime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileModificationDate]],
            @"name": obj,
            @"path": path,
            @"size": [attributes objectForKey:NSFileSize],
            @"type": [attributes objectForKey:NSFileType]
            }];
    }
  }

  if (error) {
    return [self reject:reject withError:error];
  }

  resolve(tagetContents);
}

RCT_EXPORT_METHOD(exists:(NSString *)filepath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(__unused RCTPromiseRejectBlock)reject)
{
  BOOL fileExists = [[NSFileManager defaultManager] fileExistsAtPath:filepath];

  resolve([NSNumber numberWithBool:fileExists]);
}

RCT_EXPORT_METHOD(stat:(NSString *)filepath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSError *error = nil;
  NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:filepath error:&error];

  if (error) {
    return [self reject:reject withError:error];
  }

  attributes = @{
                 @"ctime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileCreationDate]],
                 @"mtime": [self dateToTimeIntervalNumber:(NSDate *)[attributes objectForKey:NSFileModificationDate]],
                 @"size": [attributes objectForKey:NSFileSize],
                 @"type": [attributes objectForKey:NSFileType],
                 @"mode": @([[NSString stringWithFormat:@"%ld", (long)[(NSNumber *)[attributes objectForKey:NSFilePosixPermissions] integerValue]] integerValue])
                 };

  resolve(attributes);
}

RCT_EXPORT_METHOD(writeFile:(NSString *)filepath
                  contents:(NSString *)base64Content
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Content options:NSDataBase64DecodingIgnoreUnknownCharacters];

  NSMutableDictionary *attributes = [[NSMutableDictionary alloc] init];

  if ([options objectForKey:@"NSFileProtectionKey"]) {
    [attributes setValue:[options objectForKey:@"NSFileProtectionKey"] forKey:@"NSFileProtectionKey"];
  }

  BOOL success = [[NSFileManager defaultManager] createFileAtPath:filepath contents:data attributes:attributes];

  if (!success) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
  }

  return resolve(nil);
}

RCT_EXPORT_METHOD(appendFile:(NSString *)filepath
                  contents:(NSString *)base64Content
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Content options:NSDataBase64DecodingIgnoreUnknownCharacters];

  NSFileManager *fM = [NSFileManager defaultManager];

  if (![fM fileExistsAtPath:filepath])
  {
    BOOL success = [[NSFileManager defaultManager] createFileAtPath:filepath contents:data attributes:nil];

    if (!success) {
      return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
    } else {
      return resolve(nil);
    }
  }

  @try {
    NSFileHandle *fH = [NSFileHandle fileHandleForUpdatingAtPath:filepath];

    [fH seekToEndOfFile];
    [fH writeData:data];

    return resolve(nil);
  } @catch (NSException *exception) {
    NSMutableDictionary * info = [NSMutableDictionary dictionary];
    [info setValue:exception.name forKey:@"ExceptionName"];
    [info setValue:exception.reason forKey:@"ExceptionReason"];
    [info setValue:exception.callStackReturnAddresses forKey:@"ExceptionCallStackReturnAddresses"];
    [info setValue:exception.callStackSymbols forKey:@"ExceptionCallStackSymbols"];
    [info setValue:exception.userInfo forKey:@"ExceptionUserInfo"];
    NSError *err = [NSError errorWithDomain:@"RNFS" code:0 userInfo:info];
    return [self reject:reject withError:err];
  }
}

RCT_EXPORT_METHOD(write:(NSString *)filepath
                  contents:(NSString *)base64Content
                  position:(NSInteger)position
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Content options:NSDataBase64DecodingIgnoreUnknownCharacters];

  NSFileManager *fM = [NSFileManager defaultManager];

  if (![fM fileExistsAtPath:filepath])
  {
    BOOL success = [[NSFileManager defaultManager] createFileAtPath:filepath contents:data attributes:nil];

    if (!success) {
      return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
    } else {
      return resolve(nil);
    }
  }

  @try {
    NSFileHandle *fH = [NSFileHandle fileHandleForUpdatingAtPath:filepath];

    if (position >= 0) {
      [fH seekToFileOffset:position];
    } else {
      [fH seekToEndOfFile];
    }
    [fH writeData:data];

    return resolve(nil);
  } @catch (NSException *e) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: error writing file: '%@'", filepath], nil);
  }
}

RCT_EXPORT_METHOD(unlink:(NSString*)filepath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSFileManager *manager = [NSFileManager defaultManager];
  BOOL exists = [manager fileExistsAtPath:filepath isDirectory:false];

  if (!exists) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
  }

  NSError *error = nil;
  BOOL success = [manager removeItemAtPath:filepath error:&error];

  if (!success) {
    return [self reject:reject withError:error];
  }

  resolve(nil);
}

RCT_EXPORT_METHOD(mkdir:(NSString *)filepath
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSFileManager *manager = [NSFileManager defaultManager];

  NSMutableDictionary *attributes = [[NSMutableDictionary alloc] init];

  if ([options objectForKey:@"NSFileProtectionKey"]) {
      [attributes setValue:[options objectForKey:@"NSFileProtectionKey"] forKey:@"NSFileProtectionKey"];
  }

  NSError *error = nil;
    BOOL success = [manager createDirectoryAtPath:filepath withIntermediateDirectories:YES attributes:attributes error:&error];

  if (!success) {
    return [self reject:reject withError:error];
  }

  NSURL *url = [NSURL fileURLWithPath:filepath];

  if ([[options allKeys] containsObject:@"NSURLIsExcludedFromBackupKey"]) {
    NSNumber *value = options[@"NSURLIsExcludedFromBackupKey"];
    success = [url setResourceValue: value forKey: NSURLIsExcludedFromBackupKey error: &error];

    if (!success) {
      return [self reject:reject withError:error];
    }
  }

  resolve(nil);
}

RCT_EXPORT_METHOD(readFile:(NSString *)filepath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  BOOL fileExists = [[NSFileManager defaultManager] fileExistsAtPath:filepath];

  if (!fileExists) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
  }

  NSError *error = nil;

  NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:filepath error:&error];

  if (error) {
    return [self reject:reject withError:error];
  }

  if ([attributes objectForKey:NSFileType] == NSFileTypeDirectory) {
    return reject(@"EISDIR", @"EISDIR: illegal operation on a directory, read", nil);
  }

  NSData *content = [[NSFileManager defaultManager] contentsAtPath:filepath];
  NSString *base64Content = [content base64EncodedStringWithOptions:NSDataBase64EncodingEndLineWithLineFeed];

  resolve(base64Content);
}

RCT_EXPORT_METHOD(read:(NSString *)filepath
                  length: (NSInteger *)length
                  position: (NSInteger *)position
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    BOOL fileExists = [[NSFileManager defaultManager] fileExistsAtPath:filepath];

    if (!fileExists) {
        return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
    }

    NSError *error = nil;

    NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:filepath error:&error];

    if (error) {
        return [self reject:reject withError:error];
    }

    if ([attributes objectForKey:NSFileType] == NSFileTypeDirectory) {
        return reject(@"EISDIR", @"EISDIR: illegal operation on a directory, read", nil);
    }

    // Open the file handler.
    NSFileHandle *file = [NSFileHandle fileHandleForReadingAtPath:filepath];
    if (file == nil) {
        return reject(@"EISDIR", @"EISDIR: Could not open file for reading", nil);
    }

    // Seek to the position if there is one.
    [file seekToFileOffset: (int)position];

    NSData *content;
    if ((int)length > 0) {
        content = [file readDataOfLength: (int)length];
    } else {
        content = [file readDataToEndOfFile];
    }

    NSString *base64Content = [content base64EncodedStringWithOptions:NSDataBase64EncodingEndLineWithLineFeed];

    resolve(base64Content);
}

RCT_EXPORT_METHOD(hash:(NSString *)filepath
                  algorithm:(NSString *)algorithm
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  BOOL fileExists = [[NSFileManager defaultManager] fileExistsAtPath:filepath];

  if (!fileExists) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", filepath], nil);
  }

  NSError *error = nil;

  NSDictionary *attributes = [[NSFileManager defaultManager] attributesOfItemAtPath:filepath error:&error];

  if (error) {
    return [self reject:reject withError:error];
  }

  if ([attributes objectForKey:NSFileType] == NSFileTypeDirectory) {
    return reject(@"EISDIR", @"EISDIR: illegal operation on a directory, read", nil);
  }

  NSData *content = [[NSFileManager defaultManager] contentsAtPath:filepath];

  NSArray *keys = [NSArray arrayWithObjects:@"md5", @"sha1", @"sha224", @"sha256", @"sha384", @"sha512", nil];

  NSArray *digestLengths = [NSArray arrayWithObjects:
    @CC_MD5_DIGEST_LENGTH,
    @CC_SHA1_DIGEST_LENGTH,
    @CC_SHA224_DIGEST_LENGTH,
    @CC_SHA256_DIGEST_LENGTH,
    @CC_SHA384_DIGEST_LENGTH,
    @CC_SHA512_DIGEST_LENGTH,
    nil];

  NSDictionary *keysToDigestLengths = [NSDictionary dictionaryWithObjects:digestLengths forKeys:keys];

  int digestLength = [[keysToDigestLengths objectForKey:algorithm] intValue];

  if (!digestLength) {
    return reject(@"Error", [NSString stringWithFormat:@"Invalid hash algorithm '%@'", algorithm], nil);
  }

  unsigned char buffer[digestLength];

  if ([algorithm isEqualToString:@"md5"]) {
    CC_MD5(content.bytes, (CC_LONG)content.length, buffer);
  } else if ([algorithm isEqualToString:@"sha1"]) {
    CC_SHA1(content.bytes, (CC_LONG)content.length, buffer);
  } else if ([algorithm isEqualToString:@"sha224"]) {
    CC_SHA224(content.bytes, (CC_LONG)content.length, buffer);
  } else if ([algorithm isEqualToString:@"sha256"]) {
    CC_SHA256(content.bytes, (CC_LONG)content.length, buffer);
  } else if ([algorithm isEqualToString:@"sha384"]) {
    CC_SHA384(content.bytes, (CC_LONG)content.length, buffer);
  } else if ([algorithm isEqualToString:@"sha512"]) {
    CC_SHA512(content.bytes, (CC_LONG)content.length, buffer);
  } else {
    return reject(@"Error", [NSString stringWithFormat:@"Invalid hash algorithm '%@'", algorithm], nil);
  }

  NSMutableString *output = [NSMutableString stringWithCapacity:digestLength * 2];
  for(int i = 0; i < digestLength; i++)
    [output appendFormat:@"%02x",buffer[i]];

  resolve(output);
}

RCT_EXPORT_METHOD(moveFile:(NSString *)filepath
                  destPath:(NSString *)destPath
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSFileManager *manager = [NSFileManager defaultManager];

  NSError *error = nil;
  BOOL success = [manager moveItemAtPath:filepath toPath:destPath error:&error];

  if (!success) {
    return [self reject:reject withError:error];
  }

  if ([options objectForKey:@"NSFileProtectionKey"]) {
    NSMutableDictionary *attributes = [[NSMutableDictionary alloc] init];
    [attributes setValue:[options objectForKey:@"NSFileProtectionKey"] forKey:@"NSFileProtectionKey"];
    BOOL updateSuccess = [manager setAttributes:attributes ofItemAtPath:destPath error:&error];

    if (!updateSuccess) {
      return [self reject:reject withError:error];
    }
  }

  resolve(nil);
}

RCT_EXPORT_METHOD(copyFile:(NSString *)filepath
                  destPath:(NSString *)destPath
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSFileManager *manager = [NSFileManager defaultManager];

  NSError *error = nil;
  BOOL success = [manager copyItemAtPath:filepath toPath:destPath error:&error];

  if (!success) {
    return [self reject:reject withError:error];
  }

  if ([options objectForKey:@"NSFileProtectionKey"]) {
    NSMutableDictionary *attributes = [[NSMutableDictionary alloc] init];
    [attributes setValue:[options objectForKey:@"NSFileProtectionKey"] forKey:@"NSFileProtectionKey"];
    BOOL updateSuccess = [manager setAttributes:attributes ofItemAtPath:destPath error:&error];

    if (!updateSuccess) {
      return [self reject:reject withError:error];
    }
  }

  resolve(nil);
}

RCT_EXPORT_METHOD(createZipArchive:(NSString *)targetPath
                  entries:(NSArray *)entries
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSDate *startedAt = [NSDate date];
  NSFileManager *fileManager = [NSFileManager defaultManager];
  NSString *parentPath = [targetPath stringByDeletingLastPathComponent];
  if (parentPath.length > 0) {
    [fileManager createDirectoryAtPath:parentPath withIntermediateDirectories:YES attributes:nil error:nil];
  }
  [fileManager createFileAtPath:targetPath contents:nil attributes:nil];

  NSFileHandle *zipFile = [NSFileHandle fileHandleForWritingAtPath:targetPath];
  if (!zipFile) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", targetPath], nil);
  }

  NSError *error = nil;
  NSMutableData *centralDirectory = [NSMutableData data];
  uint64_t currentOffset = 0;
  uint64_t totalBytesRead = 0;
  int compressionLevel = RNFSZipCompressionLevel(options);

  for (NSDictionary *entry in entries) {
    NSString *sourcePath = [entry objectForKey:@"sourcePath"];
    NSString *archivePath = RNFSZipNormalizeEntryName([entry objectForKey:@"archivePath"], &error);
    if (!archivePath) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return [self reject:reject withError:error];
    }

    BOOL isDirectory = NO;
    if (![fileManager fileExistsAtPath:sourcePath isDirectory:&isDirectory] || isDirectory) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file or directory, open '%@'", sourcePath], nil);
    }

    NSDictionary *attributes = [fileManager attributesOfItemAtPath:sourcePath error:&error];
    if (!attributes) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return [self reject:reject withError:error];
    }

    NSDate *mtime = attributes[NSFileModificationDate];
    NSNumber *mtimeMs = [entry objectForKey:@"mtimeMs"];
    if ([mtimeMs isKindOfClass:[NSNumber class]]) {
      mtime = [NSDate dateWithTimeIntervalSince1970:[mtimeMs doubleValue] / 1000.0];
    }

    NSData *nameData = RNFSZipUTF8Data(archivePath);
    if (nameData.length > UINT16_MAX || currentOffset > UINT32_MAX) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return [self reject:reject withError:RNFSZipMakeError(@"Zip64 archives are not supported")];
    }

    uint16_t dosDate = 0;
    uint16_t dosTime = 0;
    RNFSZipGetDosDateTime(mtime, &dosDate, &dosTime);

    uint32_t localHeaderOffset = (uint32_t)currentOffset;
    NSData *localHeader = RNFSZipLocalHeader(nameData, dosDate, dosTime);
    if (!RNFSZipWriteData(zipFile, localHeader, &error)) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return [self reject:reject withError:error];
    }
    currentOffset += localHeader.length;

    uint32_t crcValue = 0;
    uint32_t compressedSize = 0;
    uint32_t uncompressedSize = 0;
    if (!RNFSZipDeflateFile(sourcePath, zipFile, compressionLevel, &crcValue, &compressedSize, &uncompressedSize, &error)) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return [self reject:reject withError:error];
    }
    currentOffset += compressedSize;
    totalBytesRead += uncompressedSize;

    NSData *descriptor = RNFSZipDataDescriptor(crcValue, compressedSize, uncompressedSize);
    if (!RNFSZipWriteData(zipFile, descriptor, &error)) {
      [fileManager removeItemAtPath:targetPath error:nil];
      return [self reject:reject withError:error];
    }
    currentOffset += descriptor.length;

    NSData *centralHeader = RNFSZipCentralDirectoryHeader(nameData, dosDate, dosTime, crcValue, compressedSize, uncompressedSize, localHeaderOffset);
    [centralDirectory appendData:centralHeader];
  }

  if (entries.count > UINT16_MAX || currentOffset > UINT32_MAX || centralDirectory.length > UINT32_MAX) {
    [fileManager removeItemAtPath:targetPath error:nil];
    return [self reject:reject withError:RNFSZipMakeError(@"Zip64 archives are not supported")];
  }

  uint32_t centralDirectoryOffset = (uint32_t)currentOffset;
  if (!RNFSZipWriteData(zipFile, centralDirectory, &error)) {
    [fileManager removeItemAtPath:targetPath error:nil];
    return [self reject:reject withError:error];
  }
  currentOffset += centralDirectory.length;

  NSData *eocd = RNFSZipEndOfCentralDirectory((uint16_t)entries.count, (uint32_t)centralDirectory.length, centralDirectoryOffset);
  if (!RNFSZipWriteData(zipFile, eocd, &error)) {
    [fileManager removeItemAtPath:targetPath error:nil];
    return [self reject:reject withError:error];
  }
  [zipFile closeFile];

  NSDictionary *targetAttributes = [fileManager attributesOfItemAtPath:targetPath error:nil];
  NSNumber *bytesWritten = targetAttributes[NSFileSize] ?: @(0);
  NSTimeInterval durationMs = [[NSDate date] timeIntervalSinceDate:startedAt] * 1000.0;
  NSLog(@"[RabbyNativeFS] [zip] op=createZipArchive entries=%lu bytes_read=%llu bytes_written=%@ duration_ms=%.0f path_tail=%@",
        (unsigned long)entries.count,
        totalBytesRead,
        bytesWritten,
        durationMs,
        targetPath);

  resolve(@{
    @"targetPath": targetPath,
    @"entries": @(entries.count),
    @"bytesRead": @(totalBytesRead),
    @"bytesWritten": bytesWritten,
    @"durationMs": @(durationMs),
  });
}

RCT_EXPORT_METHOD(extractZipEntry:(NSString *)archivePath
                  targetPath:(NSString *)targetPath
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSDate *startedAt = [NSDate date];
  NSError *error = nil;
  NSString *entryName = nil;
  NSString *requestedEntryName = [options objectForKey:@"entryName"];
  if ([requestedEntryName isKindOfClass:[NSString class]] && requestedEntryName.length > 0) {
    entryName = RNFSZipNormalizeEntryName(requestedEntryName, &error);
    if (!entryName) {
      return [self reject:reject withError:error];
    }
  }

  NSString *entryNameSuffix = [options objectForKey:@"entryNameSuffix"];
  if (![entryNameSuffix isKindOfClass:[NSString class]]) {
    entryNameSuffix = nil;
  }

  NSDictionary *entry = RNFSZipFindCentralDirectoryEntry(archivePath, entryName, entryNameSuffix, &error);
  if (!entry) {
    return [self reject:reject withError:error];
  }

  if (!RNFSZipInflateEntry(archivePath, entry, targetPath, &error)) {
    return [self reject:reject withError:error];
  }

  NSDictionary *targetAttributes = [[NSFileManager defaultManager] attributesOfItemAtPath:targetPath error:nil];
  NSNumber *bytesWritten = targetAttributes[NSFileSize] ?: @(0);
  NSTimeInterval durationMs = [[NSDate date] timeIntervalSinceDate:startedAt] * 1000.0;
  NSLog(@"[RabbyNativeFS] [zip] op=extractZipEntry entry=%@ bytes_written=%@ duration_ms=%.0f target_tail=%@",
        entry[@"entryName"],
        bytesWritten,
        durationMs,
        targetPath);

  resolve(@{
    @"archivePath": archivePath,
    @"targetPath": targetPath,
    @"entryName": entry[@"entryName"],
    @"bytesWritten": bytesWritten,
    @"durationMs": @(durationMs),
  });
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"UploadBegin",@"UploadProgress",@"DownloadBegin",@"DownloadProgress",@"DownloadResumable"];
}

RCT_EXPORT_METHOD(downloadFile:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  RNFSDownloadParams* params = [RNFSDownloadParams alloc];

  NSNumber* jobId = options[@"jobId"];
  params.fromUrl = options[@"fromUrl"];
  params.toFile = options[@"toFile"];
  NSDictionary* headers = options[@"headers"];
  params.headers = headers;
  NSNumber* background = options[@"background"];
  params.background = [background boolValue];
  NSNumber* discretionary = options[@"discretionary"];
  params.discretionary = [discretionary boolValue];
  NSNumber* cacheable = options[@"cacheable"];
  params.cacheable = cacheable ? [cacheable boolValue] : YES;
  NSNumber* progressInterval= options[@"progressInterval"];
  params.progressInterval = progressInterval;
  NSNumber* progressDivider = options[@"progressDivider"];
  params.progressDivider = progressDivider;
  NSNumber* readTimeout = options[@"readTimeout"];
  params.readTimeout = readTimeout;
  NSNumber* backgroundTimeout = options[@"backgroundTimeout"];
  params.backgroundTimeout = backgroundTimeout;
  bool hasBeginCallback = [options[@"hasBeginCallback"] boolValue];
  bool hasProgressCallback = [options[@"hasProgressCallback"] boolValue];
  bool hasResumableCallback = [options[@"hasResumableCallback"] boolValue];

  __block BOOL callbackFired = NO;

  params.completeCallback = ^(NSNumber* statusCode, NSNumber* bytesWritten) {
    if (callbackFired) {
      return;
    }
    callbackFired = YES;

    NSMutableDictionary* result = [[NSMutableDictionary alloc] initWithDictionary: @{@"jobId": jobId}];
    if (statusCode) {
      [result setObject:statusCode forKey: @"statusCode"];
    }
    if (bytesWritten) {
      [result setObject:bytesWritten forKey: @"bytesWritten"];
    }
    return resolve(result);
  };

  params.errorCallback = ^(NSError* error) {
    if (callbackFired) {
      return;
    }
    callbackFired = YES;
    return [self reject:reject withError:error];
  };

  if (hasBeginCallback) {
    params.beginCallback = ^(NSNumber* statusCode, NSNumber* contentLength, NSDictionary* headers) {
        if (self.bridge != nil)
            [self sendEventWithName:@"DownloadBegin" body:@{@"jobId": jobId,
                                                                                            @"statusCode": statusCode,
                                                                                            @"contentLength": contentLength,
                                                                                            @"headers": headers ?: [NSNull null]}];
    };
  }

  if (hasProgressCallback) {
    params.progressCallback = ^(NSNumber* contentLength, NSNumber* bytesWritten) {
        if (self.bridge != nil)
          [self sendEventWithName:@"DownloadProgress"
                                                  body:@{@"jobId": jobId,
                                                          @"contentLength": contentLength,
                                                          @"bytesWritten": bytesWritten}];
    };
  }

  if (hasResumableCallback) {
    params.resumableCallback = ^() {
        if (self.bridge != nil)
            [self sendEventWithName:@"DownloadResumable" body:@{@"jobId": jobId}];
    };
  }

  if (!self.downloaders) self.downloaders = [[NSMutableDictionary alloc] init];

  RNFSDownloader* downloader = [RNFSDownloader alloc];

  NSString *uuid = [downloader downloadFile:params];

  [self.downloaders setValue:downloader forKey:[jobId stringValue]];
    if (uuid) {
        if (!self.uuids) self.uuids = [[NSMutableDictionary alloc] init];
        [self.uuids setValue:uuid forKey:[jobId stringValue]];
    }
}

RCT_EXPORT_METHOD(stopDownload:(nonnull NSNumber *)jobId)
{
  RNFSDownloader* downloader = [self.downloaders objectForKey:[jobId stringValue]];

  if (downloader != nil) {
    [downloader stopDownload];
  }
}

RCT_EXPORT_METHOD(resumeDownload:(nonnull NSNumber *)jobId)
{
    RNFSDownloader* downloader = [self.downloaders objectForKey:[jobId stringValue]];

    if (downloader != nil) {
        [downloader resumeDownload];
    }
}

RCT_EXPORT_METHOD(isResumable:(nonnull NSNumber *)jobId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject
)
{
    RNFSDownloader* downloader = [self.downloaders objectForKey:[jobId stringValue]];

    if (downloader != nil) {
        resolve([NSNumber numberWithBool:[downloader isResumable]]);
    } else {
        resolve([NSNumber numberWithBool:NO]);
    }
}

RCT_EXPORT_METHOD(completeHandlerIOS:(nonnull NSNumber *)jobId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if (self.uuids) {
        NSString *uuid = [self.uuids objectForKey:[jobId stringValue]];
        CompletionHandler completionHandler = [completionHandlers objectForKey:uuid];
        if (completionHandler) {
            completionHandler();
            [completionHandlers removeObjectForKey:uuid];
        }
    }
    resolve(nil);
}

RCT_EXPORT_METHOD(uploadFiles:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  RNFSUploadParams* params = [RNFSUploadParams alloc];

  NSNumber* jobId = options[@"jobId"];
  params.toUrl = options[@"toUrl"];
  params.files = options[@"files"];
  params.binaryStreamOnly = [[options objectForKey:@"binaryStreamOnly"] boolValue];
  NSDictionary* headers = options[@"headers"];
  NSDictionary* fields = options[@"fields"];
  NSString* method = options[@"method"];
  params.headers = headers;
  params.fields = fields;
  params.method = method;
  bool hasBeginCallback = [options[@"hasBeginCallback"] boolValue];
  bool hasProgressCallback = [options[@"hasProgressCallback"] boolValue];

  params.completeCallback = ^(NSString* body, NSURLResponse *resp) {
    [self.uploaders removeObjectForKey:[jobId stringValue]];

    NSMutableDictionary* result = [[NSMutableDictionary alloc] initWithDictionary: @{@"jobId": jobId,
                                                                                     @"body": body}];
    if ([resp isKindOfClass:[NSHTTPURLResponse class]]) {
      [result setValue:((NSHTTPURLResponse *)resp).allHeaderFields forKey:@"headers"];
      [result setValue:[NSNumber numberWithUnsignedInteger:((NSHTTPURLResponse *)resp).statusCode] forKey:@"statusCode"];
    }
    return resolve(result);
  };

  params.errorCallback = ^(NSError* error) {
    [self.uploaders removeObjectForKey:[jobId stringValue]];
    return [self reject:reject withError:error];
  };

  if (hasBeginCallback) {
    params.beginCallback = ^() {
        if (self.bridge != nil)
          [self sendEventWithName:@"UploadBegin"
                                                  body:@{@"jobId": jobId}];
    };
  }

  if (hasProgressCallback) {
    params.progressCallback = ^(NSNumber* totalBytesExpectedToSend, NSNumber* totalBytesSent) {
        if (self.bridge != nil)
            [self sendEventWithName:@"UploadProgress"
                                                  body:@{@"jobId": jobId,
                                                          @"totalBytesExpectedToSend": totalBytesExpectedToSend,
                                                          @"totalBytesSent": totalBytesSent}];
    };
  }

  if (!self.uploaders) self.uploaders = [[NSMutableDictionary alloc] init];

  RNFSUploader* uploader = [RNFSUploader alloc];

  [uploader uploadFiles:params];

  [self.uploaders setValue:uploader forKey:[jobId stringValue]];
}

RCT_EXPORT_METHOD(stopUpload:(nonnull NSNumber *)jobId)
{
  RNFSUploader* uploader = [self.uploaders objectForKey:[jobId stringValue]];

  if (uploader != nil) {
    [uploader stopUpload];
  }
}

RCT_EXPORT_METHOD(pathForBundle:(NSString *)bundleNamed
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *path = [[NSBundle mainBundle].bundlePath stringByAppendingFormat:@"/%@.bundle", bundleNamed];
  NSBundle *bundle = [NSBundle bundleWithPath:path];

  if (!bundle) {
    bundle = [NSBundle bundleForClass:NSClassFromString(bundleNamed)];
    path = bundle.bundlePath;
  }

  if (!bundle.isLoaded) {
    [bundle load];
  }

  if (path) {
    resolve(path);
  } else {
    NSError *error = [NSError errorWithDomain:NSPOSIXErrorDomain
                                         code:NSFileNoSuchFileError
                                     userInfo:nil];

    [self reject:reject withError:error];
  }
}

RCT_EXPORT_METHOD(pathForGroup:(nonnull NSString *)groupId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *groupURL = [[NSFileManager defaultManager]containerURLForSecurityApplicationGroupIdentifier: groupId];

  if (!groupURL) {
    return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no directory for group '%@' found", groupId], nil);
  } else {
    resolve([groupURL path]);
  }
}

RCT_EXPORT_METHOD(getFSInfo:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  unsigned long long totalSpace = 0;
  unsigned long long totalFreeSpace = 0;

  __autoreleasing NSError *error = nil;
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  NSDictionary *dictionary = [[NSFileManager defaultManager] attributesOfFileSystemForPath:[paths lastObject] error:&error];

  if (dictionary) {
    NSNumber *fileSystemSizeInBytes = [dictionary objectForKey: NSFileSystemSize];
    NSNumber *freeFileSystemSizeInBytes = [dictionary objectForKey:NSFileSystemFreeSize];
    totalSpace = [fileSystemSizeInBytes unsignedLongLongValue];
    totalFreeSpace = [freeFileSystemSizeInBytes unsignedLongLongValue];

    resolve(@{
      @"totalSpace": [NSNumber numberWithUnsignedLongLong:totalSpace],
      @"freeSpace": [NSNumber numberWithUnsignedLongLong:totalFreeSpace]
    });
  } else {
    [self reject:reject withError:error];
  }
}


// [PHAsset fetchAssetsWithALAssetURLs] is deprecated and not supported in Mac Catalyst
#if !TARGET_OS_UIKITFORMAC && !TARGET_OS_OSX
/**
 * iOS Only: copy images from the assets-library (camera-roll) to a specific path, asuming
 * JPEG-Images.
 *
 * Video-Support:
 *
 * One can use this method also to create a thumbNail from a video.
 * Currently it is impossible to specify a concrete position, the OS will decide wich
 * Thumbnail you'll get then.
 * To copy a video from assets-library and save it as a mp4-file, use the method
 * copyAssetsVideoIOS.
 *
 * It is also supported to scale the image via scale-factor (0.0-1.0) or with a specific
 * width and height. Also the resizeMode will be considered.
 */
RCT_EXPORT_METHOD(copyAssetsFileIOS: (NSString *) imageUri
                  toFilepath: (NSString *) destination
                  width: (NSInteger) width
                  height: (NSInteger) height
                  scale: (CGFloat) scale
                  compression: (CGFloat) compression
                  resizeMode: (RCTResizeMode) resizeMode
                  resolver: (RCTPromiseResolveBlock) resolve
                  rejecter: (RCTPromiseRejectBlock) reject)

{
    CGSize size = CGSizeMake(width, height);

    NSURL* url = [NSURL URLWithString:imageUri];
    PHFetchResult *results = nil;
    if ([url.scheme isEqualToString:@"ph"]) {
        results = [PHAsset fetchAssetsWithLocalIdentifiers:@[[imageUri substringFromIndex: 5]] options:nil];
    } else {
        results = [PHAsset fetchAssetsWithALAssetURLs:@[url] options:nil];
    }

    if (results.count == 0) {
        NSString *errorText = [NSString stringWithFormat:@"Failed to fetch PHAsset with local identifier %@ with no error message.", imageUri];

        NSMutableDictionary* details = [NSMutableDictionary dictionary];
        [details setValue:errorText forKey:NSLocalizedDescriptionKey];
        NSError *error = [NSError errorWithDomain:@"RNFS" code:500 userInfo:details];
        [self reject: reject withError:error];
        return;
    }

    PHAsset *asset = [results firstObject];
    PHImageRequestOptions *imageOptions = [PHImageRequestOptions new];

    // Allow us to fetch images from iCloud
    imageOptions.networkAccessAllowed = YES;


    // Note: PhotoKit defaults to a deliveryMode of PHImageRequestOptionsDeliveryModeOpportunistic
    // which means it may call back multiple times - we probably don't want that
    imageOptions.deliveryMode = PHImageRequestOptionsDeliveryModeHighQualityFormat;

    BOOL useMaximumSize = CGSizeEqualToSize(size, CGSizeZero);
    CGSize targetSize;
    if (useMaximumSize) {
        targetSize = PHImageManagerMaximumSize;
        imageOptions.resizeMode = PHImageRequestOptionsResizeModeNone;
    } else {
        targetSize = CGSizeApplyAffineTransform(size, CGAffineTransformMakeScale(scale, scale));
        imageOptions.resizeMode = PHImageRequestOptionsResizeModeExact;
    }

    PHImageContentMode contentMode = PHImageContentModeAspectFill;
    if (resizeMode == RCTResizeModeContain) {
        contentMode = PHImageContentModeAspectFit;
    }

    // PHImageRequestID requestID =
    [[PHImageManager defaultManager] requestImageForAsset:asset
                                               targetSize:targetSize
                                              contentMode:contentMode
                                                  options:imageOptions
                                            resultHandler:^(UIImage *result, NSDictionary<NSString *, id> *info) {
        if (result) {

            NSData *imageData = UIImageJPEGRepresentation(result, compression );
            [imageData writeToFile:destination atomically:YES];
            resolve(destination);

        } else {
            NSMutableDictionary* details = [NSMutableDictionary dictionary];
            [details setValue:info[PHImageErrorKey] forKey:NSLocalizedDescriptionKey];
            NSError *error = [NSError errorWithDomain:@"RNFS" code:501 userInfo:details];
            [self reject: reject withError:error];

        }
    }];
}
#endif

// [PHAsset fetchAssetsWithALAssetURLs] is deprecated and not supported in Mac Catalyst
#if !TARGET_OS_UIKITFORMAC && !TARGET_OS_OSX
/**
 * iOS Only: copy videos from the assets-library (camera-roll) to a specific path as mp4-file.
 *
 * To create a thumbnail from the video, refer to copyAssetsFileIOS
 */
RCT_EXPORT_METHOD(copyAssetsVideoIOS: (NSString *) imageUri
                  atFilepath: (NSString *) destination
                  resolver: (RCTPromiseResolveBlock) resolve
                  rejecter: (RCTPromiseRejectBlock) reject)
{
  NSURL* url = [NSURL URLWithString:imageUri];
  //unused?
  //__block NSURL* videoURL = [NSURL URLWithString:destination];
  __block NSError *error = nil;

  PHFetchResult *phAssetFetchResult = nil;
  if ([url.scheme isEqualToString:@"ph"]) {
      phAssetFetchResult = [PHAsset fetchAssetsWithLocalIdentifiers:@[[imageUri substringFromIndex: 5]] options:nil];
  } else {
      phAssetFetchResult = [PHAsset fetchAssetsWithALAssetURLs:@[url] options:nil];
  }

  PHAsset *phAsset = [phAssetFetchResult firstObject];

  PHVideoRequestOptions *options = [[PHVideoRequestOptions alloc] init];
  options.networkAccessAllowed = YES;
  options.version = PHVideoRequestOptionsVersionOriginal;
  options.deliveryMode = PHVideoRequestOptionsDeliveryModeAutomatic;

  dispatch_group_t group = dispatch_group_create();
  dispatch_group_enter(group);

  [[PHImageManager defaultManager] requestAVAssetForVideo:phAsset options:options resultHandler:^(AVAsset *asset, AVAudioMix *audioMix, NSDictionary *info) {

    if ([asset isKindOfClass:[AVURLAsset class]]) {
      NSURL *url = [(AVURLAsset *)asset URL];
      NSLog(@"Final URL %@",url);
      BOOL writeResult = false;
        
      if (@available(iOS 9.0, *)) {
          NSURL *destinationUrl = [NSURL fileURLWithPath:destination relativeToURL:nil];
          writeResult = [[NSFileManager defaultManager] copyItemAtURL:url toURL:destinationUrl error:&error];
      } else {
          NSData *videoData = [NSData dataWithContentsOfURL:url];
          writeResult = [videoData writeToFile:destination options:NSDataWritingAtomic error:&error];
      }
        
      if(writeResult) {
        NSLog(@"video success");
      }
      else {
        NSLog(@"video failure");
      }
      dispatch_group_leave(group);
    }
  }];
  dispatch_group_wait(group,  DISPATCH_TIME_FOREVER);

  if (error) {
    NSLog(@"RNFS: %@", error);
    return [self reject:reject withError:error];
  }

  return resolve(destination);
}
#endif

RCT_EXPORT_METHOD(touch:(NSString*)filepath
                  mtime:(NSDate *)mtime
                  ctime:(NSDate *)ctime
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSFileManager *manager = [NSFileManager defaultManager];
    BOOL exists = [manager fileExistsAtPath:filepath isDirectory:false];

    if (!exists) {
        return reject(@"ENOENT", [NSString stringWithFormat:@"ENOENT: no such file, open '%@'", filepath], nil);
    }

    NSMutableDictionary *attr = [NSMutableDictionary dictionary];

    if (mtime) {
        [attr setValue:mtime forKey:NSFileModificationDate];
    }
    if (ctime) {
        [attr setValue:ctime forKey:NSFileCreationDate];
    }

    NSError *error = nil;
    BOOL success = [manager setAttributes:attr ofItemAtPath:filepath error:&error];

    if (!success) {
        return [self reject:reject withError:error];
    }

    resolve(nil);
}


- (NSNumber *)dateToTimeIntervalNumber:(NSDate *)date
{
  return @([date timeIntervalSince1970]);
}

- (void)reject:(RCTPromiseRejectBlock)reject withError:(NSError *)error
{
  NSString *codeWithDomain = [NSString stringWithFormat:@"E%@%zd", error.domain.uppercaseString, error.code];
  reject(codeWithDomain, error.localizedDescription, error);
}

- (NSString *)getPathForDirectory:(int)directory
{
  NSArray *paths = NSSearchPathForDirectoriesInDomains(directory, NSUserDomainMask, YES);
  return [paths firstObject];
}

- (NSDictionary *)constantsToExport
{
  return @{
           @"RNFSMainBundlePath": [[NSBundle mainBundle] bundlePath],
           @"RNFSCachesDirectoryPath": [self getPathForDirectory:NSCachesDirectory],
           @"RNFSDocumentDirectoryPath": [self getPathForDirectory:NSDocumentDirectory],
           @"RNFSExternalDirectoryPath": [NSNull null],
           @"RNFSExternalStorageDirectoryPath": [NSNull null],
           @"RNFSTemporaryDirectoryPath": NSTemporaryDirectory(),
           @"RNFSLibraryDirectoryPath": [self getPathForDirectory:NSLibraryDirectory],
           @"RNFSFileTypeRegular": NSFileTypeRegular,
           @"RNFSFileTypeDirectory": NSFileTypeDirectory,
           @"RNFSFileProtectionComplete": NSFileProtectionComplete,
           @"RNFSFileProtectionCompleteUnlessOpen": NSFileProtectionCompleteUnlessOpen,
           @"RNFSFileProtectionCompleteUntilFirstUserAuthentication": NSFileProtectionCompleteUntilFirstUserAuthentication,
           @"RNFSFileProtectionNone": NSFileProtectionNone
          };
}

+(void)setCompletionHandlerForIdentifier: (NSString *)identifier completionHandler: (CompletionHandler)completionHandler
{
    if (!completionHandlers) completionHandlers = [[NSMutableDictionary alloc] init];
    [completionHandlers setValue:completionHandler forKey:identifier];
}

@end
