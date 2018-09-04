const assert = require('assert');
const opentracing = require('opentracing');
const express = require('express');
const request = require('supertest');
const sinon = require('sinon');
const hapi16 = require('hapi16');

describe('tracer stub', function() {
  var $mock;
  var $tracer;
  beforeEach(function() {
    $mock = new opentracing.MockTracer();
    $tracer = require('../lib/tracer')({}, {}, {}, $mock);
  });

  describe('when wrapped', function() {
    it('should contain standard format definitions', function() {
      assert.equal($tracer.FORMAT_HTTP_HEADERS, opentracing.FORMAT_HTTP_HEADERS);
      assert.equal($tracer.FORMAT_TEXT_MAP, opentracing.FORMAT_TEXT_MAP);
    });

    it('should contain standard tags', function() {
      assert.equal($tracer.Tags.ERROR, opentracing.Tags.ERROR);
      assert.equal($tracer.Tags.HTTP_METHOD, opentracing.Tags.HTTP_METHOD);
    });

    it('should define auth0 specific tags', function() {
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_TENANT');
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_ENVIRONMENT');
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_REGION');
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_CHANNEL');
    });
  });

  describe('wrapped spans', function() {
    it('should be able to be started and finished', function() {
      $tracer.startSpan('foo').finish();
      const report = $mock.report();
      assert.equal(1, report.spans.length);
    });

    it('should support tags', function() {
      const span = $tracer.startSpan('foo');
      span.setTag('test_tag', 'test_val');
      span.finish();
      assert.ok($mock.report().firstSpanWithTagValue('test_tag', 'test_val'));
    });

    it('should return the wrapped tracer for tracer()', function() {
      assert.hasOwnProperty(
        $tracer.startSpan('foo').tracer(), 'AUTH0_TENANT');
    });
  });

  describe('captured functions', function() {
    it('should automatically create spans', function() {
      const parentSpan = $tracer.startSpan('parent');
      $tracer.captureFunc('child_operation', function(span) {
        span.setTag('in_child', true);
      }, parentSpan);
      parentSpan.finish();
      const report = $mock.report();
      assert.equal(2, report.spans.length);
      assert.ok(report.firstSpanWithTagValue('in_child', true));
    });

    it('should support nesting', function() {
      const rootSpan = $tracer.startSpan('parent');
      $tracer.captureFunc('child1', function(child1) {
        $tracer.captureFunc('child2', function(child2) {
          child2.setTag('in_child_two', true);
        }, child1);
      }, rootSpan);
      rootSpan.finish();
      const report = $mock.report();
      assert.equal(3, report.spans.length);
      assert.ok(report.firstSpanWithTagValue('in_child_two', true));
    });

    it('should tag failed spans with errors', function() {
      const parentSpan = $tracer.startSpan('parent');
      const err = new Error('expected');
      assert.throws(function() {
        $tracer.captureFunc('child_operation', function() {
          throw err;
        });
      }, 'expected');
      parentSpan.finish();
      const report = $mock.report();
      assert.equal(2, report.spans.length);
      const child = report.firstSpanWithTagValue($tracer.Tags.ERROR, true);
      assert.ok(child);
      assert.equal('child_operation', child.operationName());
    });
  });
});

describe('tracer express middleware', function() {
  describe('middleware with stubs', function() {
    var $mock;
    var $tracer;
    var app;
    beforeEach(function() {
      $mock = new opentracing.MockTracer();
      // the mock tracer doesn't native support extract/inject.
      $mock.inject = function(span, format, carrier) {
        carrier['x-span-id'] = span.uuid();
      };
      $mock.extract = sinon.fake();
      $tracer = require('../lib/tracer')({}, {}, {}, $mock);
      app = express();
      app.use($tracer.middleware.express);
      app.get('/success', function(req, res) {
        res.status(200).send('ok');
      });
      app.get('/error', function(req, res) {
        res.status(500).send('error');
      });
      app.get('/exception', function() {
        throw new Error('expected');
      });
      app.get('/moreinfo', function(req, res) {
        req.a0trace.span.setTag('moreinfo', 'here');
        res.status(200).send('ok');
      });
    });

    it('should create new child spans', function(done) {
      request(app)
        .get('/success')
        .expect(200)
        .expect(function() {
          const report = $mock.report();
          assert.equal(1, report.spans.length);
          const child = report.firstSpanWithTagValue($tracer.Tags.HTTP_STATUS_CODE, 200);
          assert.ok(child);
          assert.equal('/success', child.operationName());
          assert.equal('GET', child.tags()[$tracer.Tags.HTTP_METHOD]);
          assert.equal($tracer.Tags.SPAN_KIND_RPC_SERVER, child.tags()[$tracer.Tags.SPAN_KIND]);
        })
        .then(() =>  { done(); })
        .catch(err => { done(err); });
    });

    it('should make the created span available to the request', function(done) {
      request(app)
        .get('/moreinfo')
        .expect(200)
        .expect(function() {
          const report = $mock.report();
          assert.equal(1, report.spans.length);
          assert.ok(report.firstSpanWithTagValue('moreinfo', 'here'));
        })
        .then(() => { done(); })
        .catch(err => { done(err); });

    });

    it('should set error tags on status codes >= 500', function(done) {
      request(app)
        .get('/error')
        .expect(500)
        .expect(function() {
          const report = $mock.report();
          assert.equal(1, report.spans.length);
          const child = report.firstSpanWithTagValue($tracer.Tags.HTTP_STATUS_CODE, 500);
          assert.ok(child);
          assert.equal('/error', child.operationName());
          assert.equal('GET', child.tags()[$tracer.Tags.HTTP_METHOD]);
          assert.equal($tracer.Tags.SPAN_KIND_RPC_SERVER, child.tags()[$tracer.Tags.SPAN_KIND]);
          assert.ok(child.tags()[$tracer.Tags.ERROR]);
        })
        .then(() => { done(); })
        .catch(err => { done(err); });
        
    });

    it('should set error tags on exceptions', function(done) {
      request(app)
        .get('/exception')
        .expect(500)
        .expect(function() {
          const report = $mock.report();
          assert.equal(1, report.spans.length);
          const child = report.firstSpanWithTagValue($tracer.Tags.HTTP_STATUS_CODE, 500);
          assert.ok(child);
          assert.equal('/exception', child.operationName());
          assert.equal('GET', child.tags()[$tracer.Tags.HTTP_METHOD]);
          assert.equal($tracer.Tags.SPAN_KIND_RPC_SERVER, child.tags()[$tracer.Tags.SPAN_KIND]);
          assert.ok(child.tags()[$tracer.Tags.ERROR]);
        })
        .then(() => { done(); })
        .catch(err => { done(err); });
    });

    it('should include span headers in the response', function(done) {
      request(app)
        .get('/success')
        .expect(200)
        .expect(function(res) {
          const report = $mock.report();
          assert.equal(1, report.spans.length);
          const child = report.firstSpanWithTagValue($tracer.Tags.HTTP_STATUS_CODE, 200);
          assert.ok(child);
          assert.equal(child.uuid(), res.get('x-span-id'));
        })
        .then(() => { done(); })
        .catch(err => { done(err); });
    });
  });
});

describe('tracer using jaeger-client', function() {
  var $tracer;
  beforeEach(function() {
    $tracer = require('../lib/tracer')({}, {
      name: 'auth0-service'
    }, {
      TRACE_AGENT_CLIENT: 'jaeger',
      TRACE_AGENT_HOST: 'jaeger.auth0.net',
      TRACE_AGENT_PORT: 6831
    });
  });

  describe('when wrapped', function() {
    it('should use the right service name', function() {
      assert.equal($tracer._tracer._process.serviceName, 'auth0-service');
    });

    it('should use a jaeger-client tracer', function() {
      assert.equal($tracer._tracer._process.tags.filter((t) => t.key === 'jaeger.version').length, 1);
    });

    it('should send spans to the right location', function() {
      assert.equal($tracer._tracer._reporter._sender._host, 'jaeger.auth0.net');
      assert.equal($tracer._tracer._reporter._sender._port, 6831);
    });

    it('should contain standard format definitions', function() {
      assert.equal($tracer.FORMAT_HTTP_HEADERS, opentracing.FORMAT_HTTP_HEADERS);
      assert.equal($tracer.FORMAT_TEXT_MAP, opentracing.FORMAT_TEXT_MAP);
    });

    it('should contain standard tags', function() {
      assert.equal($tracer.Tags.ERROR, opentracing.Tags.ERROR);
      assert.equal($tracer.Tags.HTTP_METHOD, opentracing.Tags.HTTP_METHOD);
    });

    it('should define auth0 specific tags', function() {
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_TENANT');
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_ENVIRONMENT');
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_REGION');
      assert.hasOwnProperty($tracer.Tags, 'AUTH0_CHANNEL');
    });
  });
});

describe('tracer hapi16 middleware', function() {
  // We expect 4 spans:
  //  - request (top level span)
  //  - auth
  //  - handler
  //  - response
  const SPAN_COUNT = 4;
  describe('middleware with stubs', function() {
    var server;
    var mock;
    var tracer;
    beforeEach(done => {
      mock = new opentracing.MockTracer();
      mock.inject = (span, format, carrier) => {
        carrier['x-span-id'] = span.uuid();
      };
      mock.extract = sinon.fake();
      tracer = require('../lib/tracer')({}, {}, {}, mock);

      server = new hapi16.Server();
      server.connection({ port: 9999 });
      server.route({
        method: 'GET',
        path: '/success',
        handler: (request, reply) => {
          reply('ok');
        }
      });
      server.route({
        method: 'GET',
        path: '/failure',
        handler: (request, reply) => {
          reply('server error').statusCode = 500;
        }
      });
      server.route({
        method: 'GET',
        path: '/error',
        handler: (request, reply) => {
          reply(new Error('failure'));
        }
      });
      server.route({
        method: 'GET',
        path: '/moreinfo',
        handler: (request, reply) => {
          request.a0trace.span.setTag('more_info', 'here');
          reply('ok');
        }
      });
      server.register(tracer.middleware.hapi16, err => {
        if (err) { done(err); }
      });
      server.start(done);
    });

    afterEach(done => {
      server.stop(done);
    });

    it('should create new child spans', function() {
      const req = { method: 'GET', url: `${server.info.uri}/success` };
      return server.inject(req)
        .then(res => {
          assert.equal(200, res.statusCode);
          const report = mock.report();
          assert.equal(SPAN_COUNT, report.spans.length);
          const reqSpan = report.firstSpanWithTagValue(tracer.Tags.HTTP_STATUS_CODE, 200);
          assert.ok(reqSpan);
          assert.equal('/success', reqSpan.operationName());
        });
    });

    it('should set error tags on failure', function() {
      const req = { method: 'GET', url: `${server.info.uri}/failure` };
      return server.inject(req)
        .then(res => {
          assert.equal(500, res.statusCode);
          const report = mock.report();
          assert.equal(SPAN_COUNT, report.spans.length);
          const reqSpan = report.firstSpanWithTagValue(tracer.Tags.ERROR, true);
          assert.ok(reqSpan);
          assert.equal('/failure', reqSpan.operationName());
        });
    });

    it('should set error tags on exceptions', function() {
      const req = { method: 'GET', url: `${server.info.uri}/error` };
      return server.inject(req)
        .then(res => {
          assert.equal(500, res.statusCode);
          const report = mock.report();
          assert.equal(SPAN_COUNT, report.spans.length);
          const reqSpan = report.firstSpanWithTagValue(tracer.Tags.ERROR, true);
          assert.ok(reqSpan);
          assert.equal('/error', reqSpan.operationName());
        });
    });

    it('should include span headers in the response when successful', function() {
      const req = { method: 'GET', url: `${server.info.uri}/success` };
      return server.inject(req)
        .then(res => {
          assert.equal(200, res.statusCode);
          const report = mock.report();
          const child = report.firstSpanWithTagValue(tracer.Tags.HTTP_STATUS_CODE, 200);
          assert.ok(child);
          assert.equal(child.uuid(), res.headers['x-span-id']);
        });
    });

    it('should include span headers in the response for failures', function() {
      const req = { method: 'GET', url: `${server.info.uri}/error` };
      return server.inject(req)
        .then(res => {
          assert.equal(500, res.statusCode);
          const report = mock.report();
          const child = report.firstSpanWithTagValue(tracer.Tags.HTTP_STATUS_CODE, 500);
          assert.ok(child);
          assert.equal(child.uuid(), res.headers['x-span-id']);
        });
    });

    it('should make the created span available to handlers', function() {
      const req = { method: 'GET', url: `${server.info.uri}/moreinfo` };
      return server.inject(req)
        .then(res => {
          assert.equal(200, res.statusCode);
          const report = mock.report();
          assert.equal(4, report.spans.length);
          const reqSpan = report.firstSpanWithTagValue('more_info', 'here');
          assert.ok(reqSpan);
          assert.equal('/moreinfo', reqSpan.operationName());
        });
    });

  });
});
