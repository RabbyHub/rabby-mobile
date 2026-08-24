# Rabby Native OpenAPI

This package contains native-only Rabby OpenAPI synchronization infrastructure.
It has no generic JavaScript HTTP entry point. It depends on
`@rabby-wallet/rabby-native-http`: transport remains business-agnostic while
this package owns request validation, credential rotation, response parsing,
and database synchronization.

The request-signing implementation is deliberately excluded. A separately
reviewed private package must inject `OpenApiRequestSigner`. The public package
passes a normalized method, path, parameters, nonce, timestamp, and real
application identity to that boundary. Missing private integration fails before
transport; unsigned fallback is not permitted.

`SigningParameter::value` is already the normalized legacy string
representation. `prepareOpenApiRequest` derives both the encoded wire query and
the private signer input from that one collection. A missing value is omitted
like the current Axios path; an empty string remains `key=`. Endpoint builders
must not concatenate query strings into `uriPath` or create a second query
normalization path.

The request builder owns `X-Client`, `X-Version`, optional API credential, and
the private signer header boundary. Caller-supplied collisions and signer
headers outside that owned set are rejected. It accepts only an HTTPS origin
and a separate encoded ASCII path, so credentials, fragments, base paths, and
preassembled query strings cannot bypass normalization.

## API credential lifecycle

The API credential is independent from, and used alongside, the legacy v2
request signature. `ApiCredentialManager` implements the current
`@rabby-wallet/rabby-api` protocol:

1. Load the persisted `apiKey` and `apiTime`, or generate and persist an initial
   installation credential through platform-supplied secure UUID and clock
   providers.
2. Take a revisioned snapshot for each request. `prepareOpenApiRequest` emits
   its value as `X-API-Key` and `X-API-Time` and retains the snapshot with the
   prepared request.
3. On a successful HTTP response, consume the case-insensitive
   `x-set-api-key` response header. The server-returned value is already the
   processed key and is persisted without client-side transformation.
4. Publish the new key only after persistence succeeds. Preserve the original
   `apiTime`, and ignore a response whose request revision is no longer current
   so concurrent requests cannot roll the credential backward.

The manager deliberately receives persistence, secure key generation, and time
as dependencies. The Android and Apple adapters bind those to platform storage
and cryptographically secure UUID generation. React Native exposes only the
fixed non-production diagnostic; no generic HTTP surface is introduced here.

## Non-production diagnostics

The regression and debug builds expose fixed diagnostics through `DevPerf`;
production application identifiers reject every diagnostic call in native code.
`native-openapi-token-sync` exercises the request, response parsing, native
SQLite commit, and JavaScript hydration path for one address when the private
signer integration is present.
`native-openapi-storage` independently verifies persistence when the remote API
is unavailable: it writes one reserved probe row through the production schema
and binders, executes the stale-row delete, always rolls the transaction back,
and then proves that no probe row escaped the rollback. Neither action exposes a
generic HTTP, SQL, table, or arbitrary-payload API to JavaScript.

Each call prepares exactly one dispatch attempt. Retry code must call the
builder again with a new nonce and timestamp. To preserve current OpenAPI v2
behavior, JSON body bytes are transported unchanged but are not part of the
signature.

Public request tests inject a fake signer and cover query encoding, nil
omission, header ownership, missing-signer failure, API credentials, POST
bodies, invalid origins and paths, duplicate query keys, and shared HTTP
validation. The private package owns signer compatibility vectors. Credential
lifecycle tests cover bootstrap persistence, existing credentials, response
rotation, stale-response suppression, non-2xx behavior, malformed or
conflicting response headers, persistence failures, and the full
request-response-next-request transition.
