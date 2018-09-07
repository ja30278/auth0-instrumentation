const assert = require('assert');
const sinon = require('sinon');

const Profiler = require('../lib/profiler');

describe('Profiler', function() {
  var profiler, agent;
  beforeEach(function() {
    agent = {
      metrics: {
        histogram: sinon.spy()
      },
      logger: {
        info: sinon.spy()
      }
    };
    profiler = new Profiler(agent, { name: 'test' }, { HUNT_MEMORY_LEAKS: true });
    // avoid having to create workers
    sinon.replace(process, 'send', sinon.fake());
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('#createThrottledSnapshot', function() {
    it('should create a snapshot and report', function(done) {
      // this test can be flaky, due to slowness in writing or snapshotting.
      this.retries(3);
      sinon.replace(profiler, 'report', sinon.spy());
      this.timeout(3000);
      profiler.createThrottledSnapshot('testing');
      setTimeout(() => {
        try {
          assert(profiler.report.calledOnceWith(sinon.match.defined, sinon.match('testing')));
          done();
        } catch (err) {
          done(err);
        }
      }, 1000);
    });
  });

  describe('#createProfile', function() {
    it('should create a profile', function(done) {
      this.timeout(3000);
      profiler.createProfile(1000, function(err, path) {
        try {
          assert.ifError(err);
          assert(path);
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});
