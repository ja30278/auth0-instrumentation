var assert = require('assert');

var agent = require('../');
var errorReporter = agent.errorReporter;
var metrics = agent.metrics;
var logger = agent.logger;
var tracer = agent.tracer;

describe('stubs', function() {

  describe('error_reporter', function() {

    it('should return isActive as false', function(done) {
      assert.equal(errorReporter.isActive, false);
      done();
    });

    it('should run captureException without throwing', function(done) {
      assert.doesNotThrow(errorReporter.captureException, TypeError);
      done();
    });

    it('should run patchGlobal without throwing', function(done) {
      assert.doesNotThrow(errorReporter.patchGlobal, TypeError);
      done();
    });

    it('should have a hapi plugin', function(done) {
      assert.doesNotThrow(function() {
        errorReporter.hapi.plugin.register.attributes;
      }, TypeError);
      done();
    });

    it('should have a hapi v17 plugin', function(done) {
      assert.doesNotThrow(function() {
        errorReporter.hapi.plugin.pkg.name;
      }, TypeError);
      done();
    });

    it('should have an express plugin', function(done) {
      assert.doesNotThrow(function() {
        errorReporter.express.requestHandler;
        errorReporter.express.errorHandler;
      }, TypeError);
      done();
    });

  });

  describe('metrics', function() {

    it('should return isActive as false', function(done) {
      assert.equal(metrics.isActive, false);
      done();
    });

    it('should run gauge without throwing', function(done) {
      assert.doesNotThrow(metrics.gauge, TypeError);
      done();
    });

    it('should run increment without throwing', function(done) {
      assert.doesNotThrow(metrics.increment, TypeError);
      done();
    });

    it('should run histogram without throwing', function(done) {
      assert.doesNotThrow(metrics.histogram, TypeError);
      done();
    });

    it('should run flush without throwing', function(done) {
      assert.doesNotThrow(metrics.flush, TypeError);
      done();
    });

    it('should run setDefaultTags without throwing', function(done) {
      assert.doesNotThrow(metrics.setDefaultTags, TypeError);
      done();
    });

    it('should run time without throwing', function(done) {
      assert.doesNotThrow(metrics.time, TypeError);
      done();
    });

    it('should run time and it should return a value', function(done) {
      assert.ok(metrics.time());
      done();
    });

    it('should run endTime without throwing', function(done) {
      assert.doesNotThrow(metrics.endTime, TypeError);
      done();
    });

    it('should run startResourceCollection without throwing', function(done) {
      assert.doesNotThrow(metrics.startResourceCollection, TypeError);
      done();
    });

    it('should run incrementOne without throwing', function(done) {
      assert.doesNotThrow(metrics.incrementOne, TypeError);
      done();
    });

    it('should run observeBucketed without throwing', function(done) {
      assert.doesNotThrow(metrics.observeBucketed, TypeError);
      done();
    });
  });

  describe('logger', function() {

    it('should run trace without throwing', function(done) {
      assert.doesNotThrow(logger.trace, TypeError);
      done();
    });

    it('should run debug without throwing', function(done) {
      assert.doesNotThrow(logger.debug, TypeError);
      done();
    });

    it('should run info without throwing', function(done) {
      assert.doesNotThrow(logger.info, TypeError);
      done();
    });

    it('should run warn without throwing', function(done) {
      assert.doesNotThrow(logger.warn, TypeError);
      done();
    });

    it('should run error without throwing', function(done) {
      assert.doesNotThrow(logger.error, TypeError);
      done();
    });

    it('should run fatal without throwing', function(done) {
      assert.doesNotThrow(logger.fatal, TypeError);
      done();
    });

  });

  describe('tracer', function() {
    it('should run startSpan without throwing', function() {
      assert.doesNotThrow(tracer.startSpan, Error);
    });

    it('should run inject without throwing', function() {
      assert.doesNotThrow(tracer.inject, Error);
    });

    it('should run extract without throwing', function() {
      assert.doesNotThrow(tracer.extract, Error);
    });

    it('should get Tags without throwing', function() {
      assert.doesNotThrow(function() { return tracer.Tags.AUTH0_TENANT; }, Error);
    });

    const span = tracer.startSpan('foo');
    describe('tracer', function() {

      it('should run finish without throwing', function() {
        assert.doesNotThrow(span.finish, Error);
      });

      it('should run setTag without throwing', function() {
        assert.doesNotThrow(span.setTag, Error);
      });

      it('shoudl run addTags without throwing', function() {
        assert.doesNotThrow(span.addTags, Error);
      });

      it('should run tracer without throwing', function() {
        assert.doesNotThrow(span.tracer, Error);
      });

      it('should run context wihout throwing', function() {
        assert.doesNotThrow(span.context, Error);
      });

      it('should run setOperationName without throwing', function() {
        assert.doesNotThrow(span.setOperationName, Error);
      });
    });
  });

});
