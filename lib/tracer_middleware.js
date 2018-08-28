const onFinished = require('on-finished');
const url = require('url');


// createRequestSpan creates a new Span for an incoming request.
function createRequestSpan(tracer, req) {
  const wireCtx = tracer.extract(tracer.FORMAT_HTTP_HEADERS, req.headers);
  const name = req.path ? req.path : url.parse(req.url).pathname;
  const span = tracer.startSpan(name, { childOf: wireCtx });
  span.setTag(tracer.Tags.HTTP_METHOD, req.method);
  span.setTag(tracer.Tags.SPAN_KIND, tracer.Tags.SPAN_KIND_RPC_SERVER);
  span.setTag(tracer.Tags.HTTP_URL, req.url);
  return span;
};

module.exports = {
  express: function(tracer) {
    return (req, res, next) => {
      const span = createRequestSpan(tracer, req);

      // Include the trace context in response headers, to facilitate debugging.
      const responseHeaders = {};
      tracer.inject(span, tracer.FORMAT_TEXT_MAP, responseHeaders);
      Object.keys(responseHeaders).forEach((key) => { res.setHeader(key, responseHeaders[key]); });


      // Assigns the span for use by the request.
      req.a0trace = {
        span: span
      };

      onFinished(res, (err, res) => {
        if (res) {
          span.setTag(tracer.Tags.HTTP_STATUS_CODE, res.statusCode);
        }
        if (err || (res && res.statusCode >= 500)) {
          span.setTag(tracer.Tags.ERROR, true);
          span.setTag(tracer.Tags.SAMPLING_PRIORITY, 1);
        }
        span.finish();
      });

      next();
    };
  },

  hapi16: function(tracer) {

    const startSpans = (req) => {
      return {
        span: createRequestSpan(tracer, req),
        tracer: tracer
      };
    };

    const onPreAuth = (req, reply) => {
      req.a0trace.auth = tracer.startSpan('auth', { childOf: req.a0trace.span });
      reply.continue();
    };

    const onPostAuth = (req, reply) => {
      req.a0trace.auth.setTag('auth.isAuthenticated', req.auth.isAuthenticated);
      req.a0trace.auth.setTag('auth.mode', req.auth.mode);
      req.a0trace.auth.finish();
      req.a0trace.auth = null;
      reply.continue();
    };

    const onPreHandler = (req, reply) => {
      req.a0trace.handler = tracer.startSpan('handler', { childOf: req.a0trace.span });
      reply.continue();
    }

    const onPreResponse = (req, reply) => {
      // We may not have an active handler span, since it's possible
      // to skip directly to the response step if routing fails.
      // See: https://hapijs.com/api/16.6.2#request-lifecycle
      if (req.a0trace.handler) {
        req.a0trace.handler.finish();
        req.a0trace.handler = null;
      }
      const response = req.response;

      // set final request status on the primary span.
      req.a0trace.span.setTag(tracer.Tags.HTTP_STATUS_CODE, response.statusCode);
      if (response.isBoom || response.statusCode >= 500) {
        req.a0trace.span.setTag(tracer.Tags.ERROR, true);
        req.a0trace.span.setTag(tracer.Tags.SAMPLING_PRIORITY, 1);
      }

      // will be automatically finished by the response event.
      req.a0trace.response = tracer.startSpan('response', { childOf: req.a0trace.span });
      reply.continue();
    }

    const finishSpans = (req) => {
      if (req && req.a0trace) {
        for (const key of Object.keys(req.a0trace)) {
          const span = req.a0trace[key];
          if (span) {
            span.finish();
          }
        }
      }
    };

    const register = function(server, options, next) {
      // Create a new request span for each incoming request.
      server.decorate('request', 'a0trace',  startSpans, {apply: true});
      server.ext('onPreAuth', onPreAuth);
      server.ext('onPostAuth', onPostAuth);
      server.ext('onPreHandler', onPreHandler);
      server.ext('onPreResponse', onPreResponse);

      server.on('response', finishSpans);
    };

    register.attributes = {
      name: 'a0trace'
    }

    return register;
  }
};
