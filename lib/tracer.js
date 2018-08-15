const tracing = require('opentracing');
const tracerFactory = require('./tracer_factory');

const noopspan = {
  finish: () => {},
}

module.exports = function Tracer(agent, pkg, env) {

  const tracer = tracerFactory.create(agent, pkg, env);

  const obj = {
    _tracer: tracer,
    _logger: agent.logger,
    FORMAT_HTTP_HEADERS: opentracing.FORMAT_HTTP_HEADERS,
    FORMAT_TEXT_MAP: opentracing.FORMAT_TEXT_MAP
  };

  obj.Tags = Object.assign({
    AUTH0_TENANT: 'auth0.tenant',
  }, opentracing.Tags);

  obj.startSpan = function(name, spanOptions = {}) {
    return obj._tracer.startSpan(name, spanOptions);
  };

  obj.inject = function(spanOrContext, format, carrier) {
    return obj._tracer.inject(spanOrContext, format, carrier);
  };

  obj.extract = function(format, carrier) {
    return obj._tracer.extract(format, carrier);
  };

  obj.captureFunc = function(name, fn, parentSpan) {
    const span = obj._tracer.startSpan(name, {childOf: parentSpan});
    try {
      fn(span);
      span.finish();
    } catch (e) {
      span.setTag(obj.Tags.ERROR, true);
      span.finish();
      throw(e);
    }
  };

  obj.captureAsync = function(name, fn, parentSpan) {
    const span = obj._tracer.startSpan(name, {childOf: parentSpan});
    try {
      fn(span);
    } catch (e) {
      span.setTag(obj.Tags.ERROR, true);
      span.finish();
    }
  };
  return obj;
};
