#import "RabbyDurationPickerView.h"
#import <react/renderer/components/RabbyDurationPickerSpec/ComponentDescriptors.h>
#import <react/renderer/components/RabbyDurationPickerSpec/EventEmitters.h>
#import <react/renderer/components/RabbyDurationPickerSpec/Props.h>
#import <react/renderer/components/RabbyDurationPickerSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;

static const CGFloat RowHeight = 40;

@interface RabbyDurationWheel : UIControl <UITableViewDataSource, UITableViewDelegate>
- (instancetype)initWithUnit:(NSCalendarUnit)unit;
- (NSInteger)snapToCenter;
@property (nonatomic) NSInteger value;
@property (nonatomic, copy) NSArray<NSString *> *labels;
@end

@implementation RabbyDurationWheel {
  UITableView *_table;
  NSDateComponentsFormatter *_formatter;
  NSCalendarUnit _unit;
  NSInteger _maxValue;
  BOOL _positioning;
}

- (instancetype)initWithUnit:(NSCalendarUnit)unit
{
  if (self = [super initWithFrame:CGRectZero]) {
    _unit = unit;
    _maxValue = unit == NSCalendarUnitHour ? 23 : 59;
    _formatter = [NSDateComponentsFormatter new];
    _formatter.allowedUnits = unit;
    _formatter.unitsStyle = unit == NSCalendarUnitHour
        ? NSDateComponentsFormatterUnitsStyleFull
        : NSDateComponentsFormatterUnitsStyleShort;
    _formatter.zeroFormattingBehavior = NSDateComponentsFormatterZeroFormattingBehaviorNone;
    self.isAccessibilityElement = YES;
    self.accessibilityTraits = UIAccessibilityTraitAdjustable;
    self.opaque = NO;
    self.contentMode = UIViewContentModeRedraw;

    _table = [[UITableView alloc] initWithFrame:CGRectZero style:UITableViewStylePlain];
    _table.rowHeight = RowHeight;
    _table.estimatedRowHeight = 0;
    _table.sectionHeaderTopPadding = 0;
    _table.separatorStyle = UITableViewCellSeparatorStyleNone;
    _table.backgroundColor = UIColor.clearColor;
    _table.contentInsetAdjustmentBehavior = UIScrollViewContentInsetAdjustmentNever;
    _table.scrollsToTop = NO;
    _table.bounces = NO;
    _table.showsVerticalScrollIndicator = NO;
    _table.decelerationRate = UIScrollViewDecelerationRateFast;
    _table.accessibilityElementsHidden = YES;
    [_table registerClass:UITableViewCell.class forCellReuseIdentifier:@"duration"];
    _table.dataSource = self;
    _table.delegate = self;
    [self addSubview:_table];
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (CGRectEqualToRect(_table.frame, self.bounds)) return;
  _positioning = YES;
  _table.frame = self.bounds;
  CGFloat padding = (CGRectGetHeight(self.bounds) - RowHeight) / 2;
  _table.contentInset = UIEdgeInsetsMake(padding, 0, padding, 0);
  [_table layoutIfNeeded];
  [_table setContentOffset:CGPointMake(0, [self offsetForValue:_value]) animated:NO];
  _positioning = NO;
  [self updateVisibleRows];
}

- (void)drawRect:(CGRect)rect
{
  CGFloat line = 1 / self.traitCollection.displayScale;
  CGFloat top = (CGRectGetHeight(self.bounds) - RowHeight) / 2;
  [UIColor.quaternaryLabelColor setFill];
  UIRectFill(CGRectMake(0, top, CGRectGetWidth(self.bounds), line));
  UIRectFill(CGRectMake(0, top + RowHeight, CGRectGetWidth(self.bounds), line));
}

- (NSString *)textForValue:(NSInteger)value
{
  if (self.labels.count == (NSUInteger)(_maxValue + 1)) return self.labels[value];
  NSDateComponents *duration = [NSDateComponents new];
  [duration setValue:value forComponent:_unit];
  return [_formatter stringFromDateComponents:duration];
}

- (void)setLabels:(NSArray<NSString *> *)labels
{
  _labels = [labels copy];
  [_table reloadData];
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section
{
  return _maxValue + 1;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath
{
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"duration" forIndexPath:indexPath];
  cell.backgroundColor = UIColor.clearColor;
  cell.selectionStyle = UITableViewCellSelectionStyleNone;
  UIListContentConfiguration *content = [UIListContentConfiguration cellConfiguration];
  content.text = [self textForValue:indexPath.row];
  content.textProperties.font = [UIFont monospacedDigitSystemFontOfSize:20 weight:UIFontWeightRegular];
  content.textProperties.color = UIColor.labelColor;
  content.textProperties.alignment = UIListContentTextAlignmentCenter;
  content.directionalLayoutMargins = NSDirectionalEdgeInsetsZero;
  cell.contentConfiguration = content;
  return cell;
}

- (void)styleCell:(UITableViewCell *)cell
{
  CGFloat distance = fabs(CGRectGetMidY(cell.frame) - CGRectGetMidY(_table.bounds)) / RowHeight;
  cell.contentView.alpha = 1 / (1 + 2 * distance * distance);
  cell.contentView.transform = CGAffineTransformMakeScale(1, MAX(0.45, 1 - distance * 0.14));
}

- (void)tableView:(UITableView *)tableView willDisplayCell:(UITableViewCell *)cell forRowAtIndexPath:(NSIndexPath *)indexPath
{
  [self styleCell:cell];
}

- (void)updateVisibleRows
{
  for (UITableViewCell *cell in _table.visibleCells) {
    [self styleCell:cell];
  }
}

- (NSInteger)valueForOffset:(CGFloat)offset
{
  return MIN(_maxValue, MAX(0, lround((offset + _table.contentInset.top) / RowHeight)));
}

- (CGFloat)offsetForValue:(NSInteger)value
{
  return value * RowHeight - _table.contentInset.top;
}

- (void)scrollViewDidScroll:(UIScrollView *)scrollView
{
  if (_positioning || CGRectIsEmpty(self.bounds)) return;
  [self updateVisibleRows];
  NSInteger nearest = [self valueForOffset:scrollView.contentOffset.y];
  if (nearest == _value) return;
  _value = nearest;
  [self sendActionsForControlEvents:UIControlEventValueChanged];
}

- (void)scrollViewWillEndDragging:(UIScrollView *)scrollView withVelocity:(CGPoint)velocity targetContentOffset:(inout CGPoint *)target
{
  target->y = [self offsetForValue:[self valueForOffset:target->y]];
}

- (void)scrollViewDidEndDragging:(UIScrollView *)scrollView willDecelerate:(BOOL)decelerate
{
  if (!decelerate) [self alignAfterScrolling];
}

- (void)scrollViewDidEndDecelerating:(UIScrollView *)scrollView
{
  [self alignAfterScrolling];
}

- (void)alignAfterScrolling
{
  if (_positioning || _table.tracking) return;
  NSInteger nearest = [self valueForOffset:_table.contentOffset.y];
  if (nearest != _value || _table.contentOffset.y != [self offsetForValue:nearest]) {
    [self selectValue:nearest];
  }
}

- (void)setValue:(NSInteger)value
{
  _positioning = YES;
  _value = MIN(_maxValue, MAX(0, value));
  // A reset or confirm can arrive with a finger down or during deceleration.
  if (@available(iOS 17.4, *)) {
    [_table stopScrollingAndZooming];
  } else {
    _table.scrollEnabled = NO;
  }
  [_table setContentOffset:CGPointMake(0, [self offsetForValue:_value]) animated:NO];
  _table.scrollEnabled = YES;
  _positioning = NO;
  [self updateVisibleRows];
}

- (NSInteger)snapToCenter
{
  self.value = CGRectIsEmpty(_table.bounds) ? _value : [self valueForOffset:_table.contentOffset.y];
  return _value;
}

- (void)selectValue:(NSInteger)value
{
  NSInteger previous = _value;
  self.value = value;
  if (_value != previous) [self sendActionsForControlEvents:UIControlEventValueChanged];
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath
{
  [self selectValue:indexPath.row];
}

- (NSString *)accessibilityValue { return [self textForValue:_value]; }
- (void)accessibilityIncrement { [self selectValue:_value + 1]; }
- (void)accessibilityDecrement { [self selectValue:_value - 1]; }
@end

@interface RabbyDurationPickerView () <RCTRabbyDurationPickerViewProtocol>
@end

@implementation RabbyDurationPickerView {
  RabbyDurationWheel *_hours;
  RabbyDurationWheel *_minutes;
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
    _sessionId = NSNotFound;
    _hours = [[RabbyDurationWheel alloc] initWithUnit:NSCalendarUnitHour];
    _minutes = [[RabbyDurationWheel alloc] initWithUnit:NSCalendarUnitMinute];
    [_hours addTarget:self action:@selector(durationChanged) forControlEvents:UIControlEventValueChanged];
    [_minutes addTarget:self action:@selector(durationChanged) forControlEvents:UIControlEventValueChanged];
    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[_hours, _minutes]];
    stack.distribution = UIStackViewDistributionFillEqually;
    self.contentView = stack;
  }
  return self;
}

- (NSInteger)currentMinutes
{
  return _hours.value * 60 + _minutes.value;
}

- (void)durationChanged
{
  if (!_eventEmitter || _sessionId == NSNotFound) return;
  auto emitter = std::static_pointer_cast<const RabbyDurationPickerEventEmitter>(_eventEmitter);
  emitter->onDurationChange({ .minutes = (int)[self currentMinutes], .sessionId = (int)_sessionId });
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &next = *std::static_pointer_cast<const RabbyDurationPickerProps>(props);
  const auto &previous = *std::static_pointer_cast<const RabbyDurationPickerProps>(_props);
  if (next.minuteLabels != previous.minuteLabels) {
    NSMutableArray<NSString *> *labels = [NSMutableArray arrayWithCapacity:next.minuteLabels.size()];
    for (const auto &label : next.minuteLabels) {
      [labels addObject:[NSString stringWithUTF8String:label.c_str()]];
    }
    _minutes.labels = labels;
  }
  // Open and Reset each start a session. Within it, durationMinutes echoes our
  // previews and may already be several rows behind the native wheels.
  if (next.sessionId != _sessionId) {
    NSInteger duration = MIN(1439, MAX(0, next.durationMinutes));
    _hours.value = duration / 60;
    _minutes.value = duration % 60;
    _sessionId = next.sessionId;
  }
  self.contentView.userInteractionEnabled = next.enabled;
  self.contentView.overrideUserInterfaceStyle = next.dark ? UIUserInterfaceStyleDark : UIUserInterfaceStyleLight;
  [super updateProps:props oldProps:oldProps];
}

- (void)handleCommand:(NSString const *)commandName args:(NSArray const *)args
{
  RCTRabbyDurationPickerHandleCommand(self, commandName, args);
}

- (void)readCurrentValue:(NSInteger)requestId
{
  if (!_eventEmitter || _sessionId == NSNotFound) return;
  NSInteger hours = [_hours snapToCenter];
  NSInteger minutes = [_minutes snapToCenter];
  auto emitter = std::static_pointer_cast<const RabbyDurationPickerEventEmitter>(_eventEmitter);
  emitter->onValueRead({
    .minutes = (int)(hours * 60 + minutes),
    .sessionId = (int)_sessionId,
    .requestId = (int)requestId
  });
}

- (void)prepareForRecycle
{
  _sessionId = NSNotFound;
  _hours.value = 0;
  _minutes.value = 0;
  [super prepareForRecycle];
}
@end
