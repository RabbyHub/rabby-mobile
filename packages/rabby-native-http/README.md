# Rabby Native HTTP

This package is the native-only byte transport used by native data
synchronization code. It intentionally has no JavaScript entry point and no
React Native module.

The shared C++ contract owns request validation, methods, headers, byte bodies,
timeouts, response limits, cancellation, and result semantics. Android executes
requests with OkHttp; Apple platforms execute them with `NSURLSession`. HTTP
status codes, including 4xx and 5xx, are responses. Transport failures are
reported separately. Redirects are also returned as HTTP responses and are not
followed automatically; a higher-level API client must make any redirect policy
explicit.

Android consumers initialize the AAR at their controlled synchronization stage
with `RabbyNativeHttpRuntime.ensureInitialized()`, then native C++ code calls
`rabby::http::makePlatformClient()`. Apple C++ consumers call the same factory.
Response bytes stay in native code so the later parser and SQLite writer do not
cross the React Native bridge.

Completions run on the platform HTTP callback queue, not the UI thread. They
must remain short: synchronization code should hand parsing, normalization, and
database writes to its own native worker rather than occupying the OkHttp
dispatcher or `NSURLSession` delegate queue.
