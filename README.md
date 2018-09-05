# auth0-instrumentation

[![Build Status](https://travis-ci.org/auth0/auth0-instrumentation.svg?branch=master)](https://travis-ci.org/auth0/auth0-instrumentation)

The goal of this package is to make it easier to collect information about our services through logs, metrics, tracing and error reporting.

## Logs

With the right configuration, logs will go from the local server to "THE CLOUD", then a bunch of awesome stuff will happen and they'll become available on [Kibana](https://www.elastic.co/products/kibana).

The logger is powered by [bunyan](https://github.com/trentm/node-bunyan), check their documentation for best practices.

Usage:

```js
var serializers = require('./serializers'); // See https://github.com/trentm/node-bunyan#serializers
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
agent.init(pkg, env, serializers);
var logger = agent.logger;

logger.info('Foo');
// logs something along the lines of:
// {"name":"foo","process":{"app":"my-app","version":"0.0.1","node":"v5.7.1"},"hostname":"dirceu-auth0.local","pid":24102,"level":30,"msg":"Foo","time":"2016-03-22T19:39:21.609Z","v":0}
logger.info({foo: 'bar'}, 'hi');
// The first field can optionally be a "fields" object, which
// is merged into the log record.
```

## Metrics

Using the right configuration, you can use a metrics collector to... well, collect metrics.

Usage:

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
agent.init(pkg, env);
var metrics = agent.metrics;

var tags = {
  'user': 'foo',
  'endpoint': '/login'
};

metrics.gauge('mygauge', 42, tags);
metrics.increment('requests.served', tags); // increment by 1
metrics.increment('some.other.thing', 5, tags); // increment by 5
metrics.histogram('service.time', 0.248);
```

## Traces

The tracing feature can be used with any backend that supports [opentracing](http://opentracing.io/).

Basic Usage:

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
agent.init(pkg, env);
var tracer = agent.tracer;

// single span
var span = tracer.startSpan('http_request');
span.setTag('external_service', 'foo');
span.finish();

// function wrapper
var parentSpan = tracer.startSpan('parent');
tracer.captureFunc('child_operation', function(span) {
  span.setTag('in_child', true);
}, parentSpan);
parentSpan.finish();

// nesting
var rootSpan = tracer.startSpan('parent');
tracer.captureFunc('child1', function(child1) {
  tracer.captureFunc('child2', function(child2) {
    child2.setTag('in_child_two', true);
  }, child1);
}, rootSpan);
rootSpan.finish();
```

The tracer also provides middleware for several common frameworks

For expressjs

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
var express = require('express');

agent.init(pkg, env);
var tracer = agent.tracer;
var app = express();

// This will automatically extract any parent span from the headers
// of incoming requests, wraps the request in a span, and will make
// the request span available to handlers as 'req.a0trace.span'
app.use(tracer.middleware.express);
```

For hapijs (only hapi16 is currently supported).

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
var hapi = require('hapi');

agent.init(pkg, env);
var tracer = agent.tracer;

var server = new hapi.Server();


// This will automatically extract any parent span from the headers
// of incoming requests, wraps the request is a span, and will make
// the request span available to handlers as 'req.a0trace.span'.
// Additional child spans are automatically created for events in
// the hapi request lifecycle.
server.register(tracer.middleware.hapi16);
```

## Errors

You can use the error reporter to send exceptions to an external service. You can set it up on your app in three ways, depending on what framework is being used.

### Hapi

For `hapi`, the error reporter is a plugin. To use it, you can do something like this:

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
agent.init(pkg, env);

var hapi = require('hapi');
var server = new hapi.Server();

// to capture hapi exceptions with context
server.register([agent.errorReporter.hapi.plugin], function() {});

// to capture a specific error with some extra information
agent.errorReporter.captureException('My error', {
  extra: {
    user: myUser,
    something: somethingElse,
    foo: 'bar'
  }
});
```

For `hapi` version 17 and above there's a specific plugin for this. You may setup this using:

```js
var hapi = require('hapi');
var server = new hapi.Server();
agent.init(pkg, env);

await server.register(agent.errorReporter.hapi.pluginV17);
```


## Express

For `express`, the error reporter is composed of two middlewares. To use it, you can do something like this:

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
agent.init(pkg, env);

var express = require('express');
var app = express();

// before any other request handlers
app.use(agent.errorReporter.express.requestHandler);

// before any other error handlers
app.use(agent.errorReporter.express.errorHandler);

// to capture a specific error with some extra information
agent.errorReporter.captureException('My error', {
  extra: {
    user: myUser,
    something: somethingElse,
    foo: 'bar'
  }
});
```

## Other

If you don't use `hapi` or `express` - maybe it's not an HTTP API, it's a worker process or a command-line application - you can do something like this:

```js
var pkg = require('./package.json');
var env = require('./lib/env');
var agent = require('auth0-instrumentation');
agent.init(pkg, env);

// to capture all uncaughts
agent.errorReporter.patchGlobal(function() {
  setTimeout(function(){
    process.exit(1);
  }, 200);
});

// to capture a specific error with some extra information
agent.errorReporter.captureException('My error', {
  extra: {
    user: myUser,
    something: somethingElse,
    foo: 'bar'
  }
});
```

## Configuration

Configuration is done through an object with predefined keys, usually coming from environment variables. You only need to configure the variables you want to change.

These are the variables that can be used, along with their default values:

```js

const env = {
  // general configuration
  'CONSOLE_LOG_LEVEL': 'info', // log level for console

  // AWS configuration for Kinesis
  'AWS_ACCESS_KEY_ID': undefined,
  'AWS_ACCESS_KEY_SECRET': undefined,
  'AWS_REGION': undefined

  // Kinesis configuration (single stream)
  'LOG_TO_KINESIS': undefined, // Kinesis stream name
  'LOG_TO_KINESIS_LEVEL': 'info', // log level for Kinesis
  'LOG_TO_KINESIS_LOG_TYPE': undefined, // bunyan stream type
  'KINESIS_OBJECT_MODE': true,
  'KINESIS_TIMEOUT': 5,
  'KINESIS_LENGTH': 50,

  // Kinesis configuration (pool of streams for failover)
  'KINESIS_POOL': [
    {
      // if any of this config options are undefined will take root level,
      // if exists
      'LOG_TO_KINESIS': undefined, // Kinesis stream name
      'LOG_TO_KINESIS_LEVEL': 'info', // log level for Kinesis
      'LOG_TO_KINESIS_LOG_TYPE': undefined, // bunyan stream type
      'AWS_ACCESS_KEY_ID': undefined,
      'AWS_ACCESS_KEY_SECRET': undefined,
      'AWS_REGION': undefined,
      'IS_PRIMARY': undefined // set as true for the kinesis instance you want to work as primary

    }
  ]

  // Error reporter configuration
  'ERROR_REPORTER_URL': undefined, // Sentry URL
  'ERROR_REPORTER_LOG_LEVEL': 'error',

  // Metrics collector configuration
  'METRICS_API_KEY': undefined, // DataDog API key
  'METRICS_HOST': require('os').hostname(),
  'METRICS_PREFIX': pkg.name + '.',
  'METRICS_FLUSH_INTERVAL': 15, // seconds

  // Tracing configuration
  'TRACE_AGENT_CLIENT': undefined, // e.g. 'jaeger'
  'TRACE_AGENT_HOST': 'localhost',
  'TRACE_AGENT_PORT': 6832
};
```

## Docker Testing
To test `auth0-instrumentation` locally in a simple container simply run
```sh
docker-compose up && docker-compose rm -f
```
