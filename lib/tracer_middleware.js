const onFinished = require('on-finished');
const url = require('url');


// createRequestSpan creates a new Span for an incoming request.
function createRequestSpan(tracer, req) {
  const wireCtx = tracer.extract(tracer.FORMAT_HTTP_HEADERS, req.headers);
  const name = req.path ? req.path : url.parse(req.url).pathname;
  const span = tracer.startSpan(name, { childOf: wireCtx });
  span.setTag(tracer.Tags.HTTP_METHOD, req.method);
  span.setTag(tracer.Tags.SPAN_KIND, tracer.Tags.SPAN_KIND_RPC_SERVER);
  span.setTag(tracer.Tags.HTTP_URL, req.url.href ? req.url.href : req.url);
  return span;
}

module.exports = {
  express: function(tracer) {
    const mw = (req, res, next) => {
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

    // Allow wrapping of existing middlware.
    mw.wrap = (name, target) => {
      const wrapped = (req, res, next) => {
        const parentCtx = req.a0trace ? req.a0trace.span : undefined;
        const span = tracer.startSpan(name, { childOf: parentCtx });

        // There are 3 ways that a middleware can complete:
        //  - calling next() (optionally with a value)
        //  - Throwing an exception
        //  - sending (and finishing) a response.
        //  We need to call span.finish() in each of these cases, but
        //  there is nothing in the opentracing spec that defines the
        //  behavior on multiple calls to finish.

        var finished = false;
        const finish = (tags) => {
          if (!finished) {
            finished = true;
            if (tags) {
              span.addTags(tags);
            }
            span.finish();
          }
        };

        const wrappedNext = function() {
          finish({'finished.by': 'next'});
          return next.apply(null, arguments);
        };

        onFinished(res, (err, _res) => {
          const tags = {'finished.by': 'response'};
          if (err) {
            tags[tracer.Tags.ERROR] = true;
            tags[tracer.Tags.SAMPLING_PRIORITY] = 1;
          }
          finish(tags);
        });

        try {
          target(req, res, wrappedNext);
        } catch (err) {
          const tags = {'finished.by': 'error'};
          tags[tracer.Tags.ERROR] = true;
          tags[tracer.Tags.SAMPLING_PRIORITY] = 1;
          finish(tags);
          throw err;
        }
      };
      return wrapped;
    };

    return mw;
  },

  hapi16: function(tracer) {

    const startSpans = (req) => {
      const span = createRequestSpan(tracer, req);
      return {
        span: span,
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
    };

    const onPreResponse = (req, reply) => {
      // We may not have an active handler span, since it's possible
      // to skip directly to the response step if routing fails.
      // See: https://hapijs.com/api/16.6.2#request-lifecycle
      if (req.a0trace.handler) {
        req.a0trace.handler.finish();
        req.a0trace.handler = null;
      }
      const response = req.response;
      const statusCode = response.isBoom ? response.output.statusCode : response.statusCode;

      // set final request status on the primary span.
      req.a0trace.span.setTag(tracer.Tags.HTTP_STATUS_CODE, statusCode);
      if (statusCode >= 500) {
        req.a0trace.span.setTag(tracer.Tags.ERROR, true);
        req.a0trace.span.setTag(tracer.Tags.SAMPLING_PRIORITY, 1);
      }

      // Inject headers for the request span into the response, for debugging.
      const responseHeaders = {};
      tracer.inject(req.a0trace.span, tracer.FORMAT_TEXT_MAP, responseHeaders);
      if (response.isBoom) {
        Object.keys(responseHeaders).forEach((key) => { response.output.headers[key] = responseHeaders[key]; });
      } else {
        Object.keys(responseHeaders).forEach((key) => { response.header(key, responseHeaders[key]); });
      }

      // will be automatically finished by the response event.
      req.a0trace.response = tracer.startSpan('response', { childOf: req.a0trace.span });
      reply.continue();
    };

    const finishSpans = (req) => {
      if (req && req.a0trace) {
        for (const key of Object.keys(req.a0trace)) {
          const span = req.a0trace[key];
          if (span && span.finish) {
            span.finish();
          }
        }
      }
    };

    const register = function(server, options, next) {
      server.decorate('request', 'a0trace',  startSpans, {apply: true});

      server.ext('onPreAuth', onPreAuth);
      server.ext('onPostAuth', onPostAuth);
      server.ext('onPreHandler', onPreHandler);
      server.ext('onPreResponse', onPreResponse);

      server.on('response', finishSpans);
      next();
    };

    register.attributes = {
      name: 'a0trace'
    };

    return register;
  },

  hapi17: function(tracer) {
    const plugin = {
      name: 'a0trace',
      version: '1.0.0',
    };
    const finishSpans = (req) => {
      if (req && req.a0trace) {
        for (const key of Object.keys(req.a0trace)) {
          const span = req.a0trace[key];
          if (span && span.finish) {
            span.finish();
          }
        }
      }
    };
    plugin.register = function(server, options) {
      server.decorate('request', 'a0trace', startSpans, {apply: true, once: true});
      server.on('response', finishSpans);
    };
  }
};
