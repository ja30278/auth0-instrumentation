const assert = require('assert');
const sinon = require('sinon');
const MemoryStream = require('memorystream');
const v8Profiler = require('v8-profiler-node8');

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
      const snapshot = {
        'export': sinon.fake.returns(new MemoryStream(['snapshot']))
      };
      sinon.replace(profiler, 'report', sinon.fake());
      sinon.replace(v8Profiler, 'takeSnapshot', sinon.fake.returns(snapshot)); 
      this.timeout(3000);
      profiler.createThrottledSnapshot('testing');
      setTimeout(() => {
        try {
          assert(1, v8Profiler.takeSnapshot.callCount);
          assert(1, profiler.report.callCount);
          assert(1, snapshot.export.callCount);
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
