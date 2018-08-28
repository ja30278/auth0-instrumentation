const middleware = require('./tracer_middleware');
const tracing = require('opentracing');
const tracerFactory = require('./tracer_factory');
const constants = require('./constants');

const noop = function() {};

const Tags = Object.assign({
  AUTH0_TENANT: constants.TAG_AUTH0_TENANT,
  AUTH0_ENVIRONMENT: constants.TAG_AUTH0_ENVIRONMENT,
  AUTH0_REGION: constants.TAG_AUTH0_REGION,
  AUTH0_CHANNEL: constants.TAG_AUTH0_CHANNEL
}, tracing.Tags);

module.exports = function Tracer(agent, pkg, env, tracerImpl) {

  const tracer = tracerImpl ? tracerImpl : tracerFactory.create(agent, pkg, env);

  const obj = {
    _tracer: tracer,
    _logger: agent.logger,
    FORMAT_HTTP_HEADERS: tracing.FORMAT_HTTP_HEADERS,
    FORMAT_TEXT_MAP: tracing.FORMAT_TEXT_MAP
  };

  obj.Tags = Tags;

  // Wrap the native opentracing 'span' object
  // with a reduced API that discourages the use
  // of features we don't want to use yet, while
  // also giving us a place to hook additional
  // functionality.
  const wrapSpan = function(srcSpan) {
    const span = Object.create(srcSpan);

    // Disable baggage.
    span.getBaggageItem = noop;
    span.setBaggageItem = noop;

    // Disable logging.
    span.log = noop;

    // Return our tracer impl instead of
    // the underlying tracer.
    span.tracer = function() {
      return obj;
    };

    return span;
  };

  obj.startSpan = function(name, spanOptions) {
    return wrapSpan(obj._tracer.startSpan(name, spanOptions));
  };

  obj.inject = function(spanOrContext, format, carrier) {
    obj._tracer.inject(spanOrContext, format, carrier);
  };

  obj.extract = function(format, carrier) {
    const span = obj._tracer.extract(format, carrier);
    return span ? wrapSpan(span) : span;
  };

  // captureFunc is a convenience function for executing a function in a child
  // span, which is passed to the function as an argument. The created span is
  // automatically finished regardless of outcome, and is tagged with an error
  // if an exception is thrown.
  obj.captureFunc = function(name, fn, parentSpan) {
    const span = obj.startSpan(name, {
      childOf: parentSpan
    });
    try {
      fn(span);
      span.finish();
    } catch (e) {
      span.setTag(obj.Tags.ERROR, true);
      span.setTag(obj.Tags.SAMPLING_PRIORITY, 1);
      span.finish();
      throw e;
    }
  };

  // Add middleware hooks.
  obj.middleware = {
    express: middleware.express(obj),
    hapi16: middleware.hapi16(obj)
  };


  return obj;
};
