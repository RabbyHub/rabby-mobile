// StartupKpi.mm
//
// Cold-start KPI, iOS side. Mirrors the Android StartupKpiModule: the first
// call reports the time from process start to the first user-visible content
// frame, which is what a user actually waits for.
//
// Emitted with os_log on a fixed subsystem so a simulator collector can read
// it without the app's JS logging pipeline:
//
//   xcrun simctl spawn <udid> log stream --predicate \
//     'subsystem == "com.debank.rabby.startupkpi"'
//
// Deliberately not gated behind any debug switch: regression and release
// builds must be able to measure themselves.

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <os/log.h>
#import <sys/sysctl.h>
#import <sys/types.h>
#import <unistd.h>

@interface StartupKpi : NSObject <RCTBridgeModule>
@end

static os_log_t RabbyStartupKpiLog(void) {
  static os_log_t log;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    log = os_log_create("com.debank.rabby.startupkpi", "kpi");
  });
  return log;
}

// KERN_PROC_PID gives the kernel's own record of when this process started,
// which is earlier than main() and includes dyld/framework loading.
static double RabbyProcessStartUnixTime(void) {
  int mib[4] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()};
  struct kinfo_proc info;
  size_t size = sizeof(info);

  memset(&info, 0, sizeof(info));
  if (sysctl(mib, 4, &info, &size, NULL, 0) != 0) {
    return 0;
  }

  struct timeval startedAt = info.kp_proc.p_starttime;
  if (startedAt.tv_sec <= 0) {
    return 0;
  }

  return (double)startedAt.tv_sec + (double)startedAt.tv_usec / 1000000.0;
}

@implementation StartupKpi {
  BOOL _reported;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// Non-production automation bridge: the simulator cannot open a custom URL
// scheme without the system "Open in ...?" prompt, so a runner delivers the
// same debug deeplinks as launch arguments instead:
//
//   xcrun simctl launch <udid> <bundle> -rabby-deeplink "rabbygo-regression://..."
//
// The JS side only consumes these when the package is non-production.
- (NSDictionary *)constantsToExport {
  return @{@"rabbyLaunchArguments" : NSProcessInfo.processInfo.arguments ?: @[]};
}

static os_log_t RabbyAutomationLog(void) {
  static os_log_t log;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    log = os_log_create("com.debank.rabby.automation", "marker");
  });
  return log;
}

// Device automation: release-like builds drop console.log, so JS-side "done"
// markers are mirrored here for the seeding scripts to read.
RCT_EXPORT_METHOD(logMarker : (NSString *)name detail : (NSString *)detail) {
  os_log(RabbyAutomationLog(),
         "automation_marker name=%{public}@ detail=%{public}@",
         name ?: @"unknown",
         detail ?: @"");
}

RCT_EXPORT_METHOD(markFirstContentFrame : (NSString *)route) {
  if (_reported) {
    return;
  }
  _reported = YES;

  double startedAt = RabbyProcessStartUnixTime();
  double now = [[NSDate date] timeIntervalSince1970];
  double nativeMs = startedAt > 0 ? (now - startedAt) * 1000.0 : -1.0;

  os_log(RabbyStartupKpiLog(),
         "first_content_frame native_ms=%.0f route=%{public}@",
         nativeMs,
         route ?: @"unknown");
}

@end
