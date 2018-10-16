const assert = require('assert');
const hapi17 = require('hapi17');
const opentracing = require('opentracing');
const sinon = require('sinon');

describe('tracer hapi17 middleware', function() {
  // We expect 4 spans:
  //  - request (top level span)
  //  - auth
  //  - handler
  //  - response
  const SPAN_COUNT = 4;
  describe('middleware with stubs', async function() {
    var server;
    var mock;
    var tracer;
    beforeEach(async () => {
      mock = new opentracing.MockTracer();
      mock.inject = (span, format, carrier) => {
        carrier['x-span-id'] = span.uuid();
      };
      mock.extract = sinon.fake();
      tracer = require('../lib/tracer')({}, {}, {}, mock);

      server = new hapi17.Server({port: 9999});
      server.route({
        method: 'GET',
        path: '/success',
        handler: async (request) => {
          return 'ok'
        }
      });
      server.route({
        method: 'GET',
        path: '/failure',
        handler: async (_request, reply) => {
          return reply.response('server error').code(500);
        }
      });
      server.route({
        method: 'GET',
        path: '/error',
        handler: async () => {
          throw new Error('failure');
        }
      });
      server.route({
        method: 'GET',
        path: '/moreinfo',
        handler: async (request, reply) => {
          request.a0trace.span.setTag('more_info', 'here');
          return 'ok';
        }
      });
      await server.register(tracer.middleware.hapi17);
      await server.start();
    });

    afterEach(async () => {
      await server.stop();
    });

    it('should create new child spans', async function() {
      const req = { method: 'GET', url: `${server.info.uri}/success` };
      const res = await server.inject(req);
      assert.equal(200, res.statusCode);
      const report = mock.report();
      assert.equal(SPAN_COUNT, report.spans.length);
      const reqSpan = report.firstSpanWithTagValue(tracer.Tags.HTTP_STATUS_CODE, 200);
      assert.ok(reqSpan);
      assert.equal('/success', reqSpan.operationName());
    });

    it('should set error tags on failure', async function() {
      const req = { method: 'GET', url: `${server.info.uri}/failure` };
      const res = await server.inject(req);
      assert.equal(500, res.statusCode);
      const report = mock.report();
      assert.equal(SPAN_COUNT, report.spans.length);
      const reqSpan = report.firstSpanWithTagValue(tracer.Tags.ERROR, true);
      assert.ok(reqSpan);
      assert.equal('/failure', reqSpan.operationName());
    });

    it('should set error tags on exceptions', async function() {
      const req = { method: 'GET', url: `${server.info.uri}/error` };
      const res = await server.inject(req);
      assert.equal(500, res.statusCode);
      const report = mock.report();
      assert.equal(SPAN_COUNT, report.spans.length);
      const reqSpan = report.firstSpanWithTagValue(tracer.Tags.ERROR, true);
      assert.ok(reqSpan);
      assert.equal('/error', reqSpan.operationName());
    });

    it('should include span headers in the response when successful', async function() {
      const req = { method: 'GET', url: `${server.info.uri}/success` };
      const res = await server.inject(req);
      assert.equal(200, res.statusCode);
      const report = mock.report();
      const child = report.firstSpanWithTagValue(tracer.Tags.HTTP_STATUS_CODE, 200);
      assert.ok(child);
      assert.equal(child.uuid(), res.headers['x-span-id']);
    });

    it('should include span headers in the response for failures', async function() {
      const req = { method: 'GET', url: `${server.info.uri}/error` };
      const res = await server.inject(req);
      assert.equal(500, res.statusCode);
      const report = mock.report();
      const child = report.firstSpanWithTagValue(tracer.Tags.HTTP_STATUS_CODE, 500);
      assert.ok(child);
      assert.equal(child.uuid(), res.headers['x-span-id']);
    });

    it('should make the created span available to handlers', async function() {
      const req = { method: 'GET', url: `${server.info.uri}/moreinfo` };
      const res = await server.inject(req);
      assert.equal(200, res.statusCode);
      const report = mock.report();
      assert.equal(4, report.spans.length);
      const reqSpan = report.firstSpanWithTagValue('more_info', 'here');
      assert.ok(reqSpan);
      assert.equal('/moreinfo', reqSpan.operationName());
    });
  });
});
