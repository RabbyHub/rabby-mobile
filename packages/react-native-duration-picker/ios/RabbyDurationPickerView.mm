#import "RabbyDurationPickerView.h"
#import <react/renderer/components/RabbyDurationPickerSpec/ComponentDescriptors.h>
#import <react/renderer/components/RabbyDurationPickerSpec/EventEmitters.h>
#import <react/renderer/components/RabbyDurationPickerSpec/Props.h>
#import <react/renderer/components/RabbyDurationPickerSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface RabbyDurationPickerView () <RCTRabbyDurationPickerViewProtocol>
@end

@implementation RabbyDurationPickerView {
  UIDatePicker *_picker;
  NSInteger _sessionId;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<RabbyDurationPickerComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _props = std::make_shared<const RabbyDurationPickerProps>();
    _picker = [[UIDatePicker alloc] init];
    _picker.datePickerMode = UIDatePickerModeCountDownTimer;
    _picker.preferredDatePickerStyle = UIDatePickerStyleWheels;
    _picker.minuteInterval = 1;
    [_picker addTarget:self action:@selector(durationChanged:) forControlEvents:UIControlEventValueChanged];
    self.contentView = _picker;
  }
  return self;
}

- (NSInteger)currentMinutes
{
  return MIN(1439, MAX(0, (NSInteger)llround(_picker.countDownDuration / 60.0)));
}

- (void)durationChanged:(UIDatePicker *)sender
{
  if (!_eventEmitter) return;
  auto emitter = std::static_pointer_cast<const RabbyDurationPickerEventEmitter>(_eventEmitter);
  emitter->onDurationChange({ .minutes = (int)[self currentMinutes], .sessionId = (int)_sessionId });
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const RabbyDurationPickerProps>(props);
  const auto &previous = *std::static_pointer_cast<const RabbyDurationPickerProps>(_props);
  if (next.sessionId != previous.sessionId ||
      (next.durationMinutes != previous.durationMinutes && next.durationMinutes != [self currentMinutes])) {
    _picker.countDownDuration = MIN(1439, MAX(0, next.durationMinutes)) * 60;
  }
  _sessionId = next.sessionId;
  _picker.userInteractionEnabled = next.enabled;
  _picker.overrideUserInterfaceStyle = next.dark ? UIUserInterfaceStyleDark : UIUserInterfaceStyleLight;
  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(NSString const *)commandName args:(NSArray const *)args
{
  RCTRabbyDurationPickerHandleCommand(self, commandName, args);
}

- (void)readCurrentValue:(NSInteger)requestId
{
  // Fabric commands and UIControl events run on the UI thread. Never read Date/timezone.
  [_picker endEditing:YES];
  if (!_eventEmitter) return;
  auto emitter = std::static_pointer_cast<const RabbyDurationPickerEventEmitter>(_eventEmitter);
  emitter->onValueRead({ .minutes = (int)[self currentMinutes], .sessionId = (int)_sessionId, .requestId = (int)requestId });
}

- (void)prepareForRecycle
{
  _sessionId = 0;
  [super prepareForRecycle];
}
@end
