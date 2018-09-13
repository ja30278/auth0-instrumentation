const path = require('path');
const protobuf = require('protobufjs');

const middleware = require('./tracer_middleware');
const tracing = require('opentracing');
const tracerFactory = require('./tracer_factory');
const constants = require('./constants');

const noop = function() {};

const protoRoot = new protobuf.Root();
protoRoot.loadSync(path.join(__dirname, 'trace_context.proto'));
const SpanContext = protoRoot.lookupType('auth0.instrumentation.SpanContext');

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
    FORMAT_TEXT_MAP: tracing.FORMAT_TEXT_MAP,
    FORMAT_AUTH0_BINARY: 'format-auth0-binary'
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

  // Inject the context required to propagate `spanOrContext` using
  // the specified format and carrier.
  // (see: https://github.com/opentracing/specification/blob/master/specification.md )
  // When using the AUTHO_BINARY format, `carrier` should be a function
  // that will receive the opaque context payload. This function will
  // not be called if injection fails, so it should not have other side
  // effects.
  // e.g.
  // var context;
  // tracer.inject(span, tracer.FORMAT_AUTH0_BINARY, (ctx) => { context = ctx });
  obj.inject = function(spanOrContext, format, carrier) {
    if (format === obj.FORMAT_AUTH0_BINARY) {
      const textCarrier = {};
      obj.inject(spanOrContext, obj.FORMAT_TEXT_MAP, textCarrier);
      const carrierMsg = SpanContext.create({
        spanContextMap: textCarrier
      });
      const encoded = SpanContext.encode(carrierMsg).finish();
      try {
        return carrier(encoded);
      } catch (err) {
        return;
        // ignore failures to propagate
      }
    }
    obj._tracer.inject(spanOrContext, format, carrier);
  };

  // Extract span context from a carrier, using the specified format.
  obj.extract = function(format, carrier) {
    if (format === obj.FORMAT_AUTH0_BINARY) {
      // Carrier should be a buffer containing a serialized
      // SpanContext proto, which will we decode, then
      // transform into a TEXT_MAP.
      try {
        const decoded = SpanContext.decode(carrier);
        return obj.extract(obj.FORMAT_TEXT_MAP, decoded.spanContextMap);
      } catch (e) {
        // ignore decode failures.
        return null;
      }
    }
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
