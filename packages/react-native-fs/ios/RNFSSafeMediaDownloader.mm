#import "RNFSSafeMediaDownloader.h"

#import <Foundation/Foundation.h>

#include <atomic>
#include <chrono>
#include <utility>

namespace {

constexpr NSInteger kMaxRedirects = 5;

BOOL RNFSIsIPLiteral(NSString *host)
{
  if ([host containsString:@":"]) {
    return YES;
  }
  NSCharacterSet *nonIPv4Characters =
      [[NSCharacterSet characterSetWithCharactersInString:@"0123456789."] invertedSet];
  return host.length > 0 && [host rangeOfCharacterFromSet:nonIPv4Characters].location == NSNotFound;
}

BOOL RNFSIsAllowedSafeMediaURL(NSURL *url)
{
  if (url == nil) {
    return NO;
  }
  NSURLComponents *components = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:YES];
  NSString *scheme = components.scheme.lowercaseString;
  NSString *host = components.host.lowercaseString;
  if (![scheme isEqualToString:@"https"] || host.length == 0 ||
      components.user.length > 0 || components.password.length > 0 ||
      (components.port != nil && components.port.integerValue != 443)) {
    return NO;
  }
  if ([host isEqualToString:@"localhost"] || [host hasSuffix:@".localhost"] ||
      [host hasSuffix:@".local"] || RNFSIsIPLiteral(host)) {
    return NO;
  }
  return YES;
}

NSOperationQueue *RNFSSafeMediaDelegateQueue(void)
{
  static NSOperationQueue *queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    queue = [[NSOperationQueue alloc] init];
    queue.name = @"com.rabby.safe-media-download";
    queue.maxConcurrentOperationCount = 3;
    queue.qualityOfService = NSQualityOfServiceUtility;
  });
  return queue;
}

} // namespace

@interface RNFSSafeMediaDownloadTask : NSObject <NSURLSessionDataDelegate, NSURLSessionTaskDelegate> {
 @private
  rabbyfs::SafeMediaDownloadRequest _request;
  rabbyfs::SafeMediaDownloadCompletion _completion;
  NSURLSession *_session;
  NSURLSessionDataTask *_task;
  NSFileHandle *_fileHandle;
  uint64_t _bytesWritten;
  NSInteger _httpStatus;
  NSInteger _redirectCount;
  std::chrono::steady_clock::time_point _deadline;
  std::atomic_bool _finished;
}

- (instancetype)initWithRequest:(rabbyfs::SafeMediaDownloadRequest)request
                      completion:(rabbyfs::SafeMediaDownloadCompletion)completion;
- (void)start;

@end

@implementation RNFSSafeMediaDownloadTask

- (instancetype)initWithRequest:(rabbyfs::SafeMediaDownloadRequest)request
                      completion:(rabbyfs::SafeMediaDownloadCompletion)completion
{
  self = [super init];
  if (self) {
    _request = std::move(request);
    _completion = std::move(completion);
    _bytesWritten = 0;
    _httpStatus = 0;
    _redirectCount = 0;
    _deadline = std::chrono::steady_clock::now() +
        std::chrono::milliseconds(_request.timeoutMs);
    _finished.store(false);
  }
  return self;
}

- (BOOL)isTimedOut
{
  return std::chrono::steady_clock::now() >= _deadline;
}

- (void)finishWithCode:(rabbyfs::SafeMediaDownloadCode)code
{
  if (_finished.exchange(true)) {
    return;
  }
  if (_fileHandle != nil) {
    @try {
      [_fileHandle closeFile];
    } @catch (__unused NSException *exception) {
    }
    _fileHandle = nil;
  }
  if (code != rabbyfs::SafeMediaDownloadCode::Ok) {
    [[NSFileManager defaultManager]
        removeItemAtPath:[NSString stringWithUTF8String:_request.destinationPath.c_str()]
                   error:nil];
  }

  rabbyfs::SafeMediaDownloadCompletion completion = std::move(_completion);
  if (_session != nil) {
    [_session invalidateAndCancel];
    _session = nil;
  }
  _task = nil;
  if (completion) {
    completion({
        code,
        static_cast<int32_t>(_httpStatus),
        _bytesWritten,
    });
  }
}

- (void)start
{
  @autoreleasepool {
    NSString *source = [NSString stringWithUTF8String:_request.url.c_str()];
    NSString *destination =
        [NSString stringWithUTF8String:_request.destinationPath.c_str()];
    NSURL *url = [NSURL URLWithString:source];
    if (!RNFSIsAllowedSafeMediaURL(url)) {
      [self finishWithCode:rabbyfs::SafeMediaDownloadCode::InvalidUrl];
      return;
    }

    NSFileManager *fileManager = [NSFileManager defaultManager];
    [fileManager removeItemAtPath:destination error:nil];
    NSDictionary *attributes = @{NSFilePosixPermissions: @0600};
    if (![fileManager createFileAtPath:destination contents:nil attributes:attributes]) {
      [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Io];
      return;
    }
    _fileHandle = [NSFileHandle fileHandleForWritingAtPath:destination];
    if (_fileHandle == nil) {
      [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Io];
      return;
    }

    NSURLSessionConfiguration *configuration =
        [NSURLSessionConfiguration ephemeralSessionConfiguration];
    configuration.URLCache = nil;
    configuration.HTTPCookieStorage = nil;
    configuration.HTTPShouldSetCookies = NO;
    configuration.requestCachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
    configuration.timeoutIntervalForRequest = _request.timeoutMs / 1000.0;
    configuration.timeoutIntervalForResource = _request.timeoutMs / 1000.0;
    configuration.HTTPAdditionalHeaders = @{
      @"Accept": @"image/svg+xml,application/xml,text/xml;q=0.9,*/*;q=0.1",
      @"User-Agent": @"RabbyMobile-SafeMedia/1",
    };
    _session = [NSURLSession sessionWithConfiguration:configuration
                                             delegate:self
                                        delegateQueue:RNFSSafeMediaDelegateQueue()];
    _task = [_session dataTaskWithURL:url];
    [_task resume];
  }
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
didReceiveResponse:(NSURLResponse *)response
 completionHandler:(void (^)(NSURLSessionResponseDisposition disposition))completionHandler
{
  NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
  _httpStatus = httpResponse.statusCode;
  if (_httpStatus < 200 || _httpStatus >= 300) {
    completionHandler(NSURLSessionResponseCancel);
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::HttpStatus];
    return;
  }
  if (response.expectedContentLength > 0 &&
      static_cast<uint64_t>(response.expectedContentLength) > _request.maxBytes) {
    completionHandler(NSURLSessionResponseCancel);
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::TooLarge];
    return;
  }
  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data
{
  if (_finished.load()) {
    return;
  }
  if ([self isTimedOut]) {
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Timeout];
    return;
  }
  if (data.length > _request.maxBytes ||
      _bytesWritten > _request.maxBytes - data.length) {
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::TooLarge];
    return;
  }
  @try {
    [_fileHandle writeData:data];
    _bytesWritten += data.length;
  } @catch (__unused NSException *exception) {
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Io];
  }
}

- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
willPerformHTTPRedirection:(NSHTTPURLResponse *)response
        newRequest:(NSURLRequest *)request
 completionHandler:(void (^)(NSURLRequest *_Nullable))completionHandler
{
  _redirectCount += 1;
  if (_redirectCount > kMaxRedirects || !RNFSIsAllowedSafeMediaURL(request.URL)) {
    completionHandler(nil);
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::InvalidUrl];
    return;
  }
  completionHandler(request);
}

- (void)URLSession:(NSURLSession *)session
              task:(NSURLSessionTask *)task
didCompleteWithError:(NSError *)error
{
  if (_finished.load()) {
    return;
  }
  if (error != nil) {
    rabbyfs::SafeMediaDownloadCode code =
        error.code == NSURLErrorTimedOut || [self isTimedOut]
        ? rabbyfs::SafeMediaDownloadCode::Timeout
        : rabbyfs::SafeMediaDownloadCode::Network;
    [self finishWithCode:code];
    return;
  }
  if (_bytesWritten == 0) {
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Network];
    return;
  }
  @try {
    [_fileHandle synchronizeFile];
  } @catch (__unused NSException *exception) {
    [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Io];
    return;
  }
  [self finishWithCode:rabbyfs::SafeMediaDownloadCode::Ok];
}

@end

rabbyfs::SafeMediaDownloadStarter RNFSCreateSafeMediaDownloadStarter(void)
{
  return [](rabbyfs::SafeMediaDownloadRequest request,
            rabbyfs::SafeMediaDownloadCompletion completion) {
    @autoreleasepool {
      RNFSSafeMediaDownloadTask *task =
          [[RNFSSafeMediaDownloadTask alloc] initWithRequest:std::move(request)
                                                   completion:std::move(completion)];
      [task start];
#if !__has_feature(objc_arc)
      [task release];
#endif
    }
  };
}
