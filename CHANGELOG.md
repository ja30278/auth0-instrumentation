# Changelog
<a name="v2.19.0"></a>
# v2.19.0
### Bugfix
* Fix undefined function call when using `PROFILE_GC` and not `HUNT_MEMORY_LEAKS`
### Feature
* Add HTTP request wrapper
* https://github.com/auth0/auth0-instrumentation/compare/v2.18.0...v2.19.0

<a name="v2.18.0"></a>
# v2.18.0
### Feature
* Add Lighstep tracker backend
* https://github.com/auth0/auth0-instrumentation/compare/v2.17.0...v2.18.0

<a name="v2.17.0"></a>
# v2.17.0
### Feature
* Add tracing support
* https://github.com/auth0/auth0-instrumentation/compare/v2.16.0...v2.17.0

<a name="v2.16.0"></a>
# v2.16.0
### Feature
* `endTime` returns the elapsed time
* https://github.com/auth0/auth0-instrumentation/compare/v2.15.1...v2.16.0

<a name="v2.15.1"></a>
# v2.15.1
### Bugfix
* Add `observeBucketed` to metic stubs
* https://github.com/auth0/auth0-instrumentation/compare/v2.15.0...v2.15.1

<a name="v2.15.0"></a>
# v2.15.0
### Bugfix
* Upgrade aws-kinesis-writable library to 4.2.0
### Feature
* Add `observeBucketed` metric type.
* https://github.com/auth0/auth0-instrumentation/compare/v2.14.1...v2.15.0

<a name="v2.14.1"></a>
# v2.14.1
### Bugfix
* Do not default to `undefined` for `purpose` and `environment`
* https://github.com/auth0/auth0-instrumentation/compare/v2.14.0...v2.14.1

<a name="v2.14.0"></a>
# v2.14.0
### Feature
* Include `purpose` and `environment` on log messages from `ENVIRONMENT` and `PURPOSE` env variables
* https://github.com/auth0/auth0-instrumentation/compare/v2.13.1...v2.14.0

<a name="v2.13.1"></a>
# v2.13.1
### Feature
* Add `incrementOne` to metrics
* https://github.com/auth0/auth0-instrumentation/compare/v2.13.0...v2.13.1

<a name="v2.13.0"></a>
# v2.13.0
### Feature
* Allow logging to file using `LOG_FILE` option
* https://github.com/auth0/auth0-instrumentation/compare/v2.12.1...v2.13.0

<a name="v2.12.1"></a>
# v2.12.1
### Bug Fix
* Avoid pushing debug/info logs to Sentry as exceptions
* https://github.com/auth0/auth0-instrumentation/compare/v2.12.0...v2.12.1

<a name="v2.12.0"></a>
# v2.12.0
### Infrastructure Changes
* Supports `hapi v17` via a factory method.
* https://github.com/auth0/auth0-instrumentation/compare/v2.11.4...v2.12.0

<a name="v2.11.4"></a>
# v2.11.4
### Infrastructure Changes
* Introduced `CONSOLE_NICE_FORMAT`
* Replaced `debounce` with `lodash.throttle@4.1.1`
* https://github.com/auth0/auth0-instrumentation/compare/v2.11.3...v2.11.4

<a name="v2.11.3"></a>
# v2.11.3
### Infrastructure Changes
* Support for full credentials object to Kinesis
* Upgrade `kinesis-writable` to `v4.1.3`

<a name="v2.11.2"></a>
# v2.11.2
### Bug Fix
* Force a partitionKey
* Fix `gc-stats` to `v1.0.2`

<a name="v2.11.1"></a>
# v2.11.1
### Bug Fix
* Upgrade `kinesis-writable` to `v4.1.2`

<a name="v2.11.0"></a>
# v2.11.0 - BROKEN
### Bug Fix
* Avoid caching wrong HTTP(s) agent

<a name="v2.10.2"></a>
# v2.10.2 - BROKEN
### Infrastructure Changes
* Bumped the version of `kinesis-writable` to `v4.1.0`.
* Support for STS Session Token on Kinesis instantiation.

<a name="v2.10.1"></a>
# v2.10.1 - BROKEN
### Infrastructure Changes
* Bumped the version of `kinesis-writable` to `v4.0.2`, which prevent undefined calls when writing records to Kinesis.

<a name="v2.10.0"></a>
# v2.10.0 - BROKEN
### Infrastructure Changes
* `init()` is now idempotent. [#77](https://github.com/auth0/auth0-instrumentation/pull/77)
* Support for Bunyan child loggers added [#76](https://github.com/auth0/auth0-instrumentation/pull/76)
* Added a `createProfile()` method on `Profile` [#72](https://github.com/auth0/auth0-instrumentation/pull/72)
* Fixed an issue in which agents could be leaked [#78](https://github.com/auth0/auth0-instrumentation/pull/78)

<a name="v2.9.2"></a>
# v2.9.2
### Infrastructure Changes
* Updated the `v8-profiler` library to `v8-profiler-node8` [#113](https://github.com/node-inspector/v8-profiler/pull/113) to regain compatibility with Node 8.

## v2.7.0

FEATURES:
* Underlying kinesis lib performs retries on failed calls.

## v2.6.0

FEATURES:
* Added Profiler which allows to take heap dumps on demand and produces GC metrics.

NOTES:
* If you already have a `profiler` in your service, you should remove it to avoid having duplicates.
