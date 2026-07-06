#pragma once

#include <jsi/jsi.h>
#include <memory>

namespace facebook::react {
class CallInvoker;
}

namespace rabbyfs {

void install(
    facebook::jsi::Runtime& runtime,
    std::shared_ptr<facebook::react::CallInvoker> jsCallInvoker = nullptr);

} // namespace rabbyfs
