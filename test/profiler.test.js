const assert = require('assert');
const sinon = require('sinon');
const $require = require('proxyquire').noPreserveCache();
const Profiler = require('../lib/profiler');

describe('Profiler', function() {
  let profiler, agent;
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
      this.timeout(5000);
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
      this.timeout(5000);
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

  describe('#setupGCReporter', () => {
    const EventEmitter = require('events');
    let stats;
    function getProfiler(env) {
      stats = new EventEmitter();
      const Profiler = $require('../lib/profiler', {
        'gc-stats': () => stats
      });

      return new Profiler(agent, { name: 'test' }, env);
    }

    describe('when there is a new GC stat', () => {
      let clock;
      beforeEach(() => {
        clock = sinon.useFakeTimers(new Date(), 'setTimeout');
      });

      afterEach(() => {
        clock.restore();
      });

      it ('does not takes snapshot', () => {
        const profiler = getProfiler({ PROFILE_GC: true });
        const createSnapshotStub = sinon.stub(profiler, 'createSnapshot');
        stats.emit('stats', { pauseMS: 1000 });
        clock.tick(6000);
        sinon.assert.notCalled(createSnapshotStub);
      });

      describe('and HUNT_LONG_GC is set', () => {
        it('does not take snapshot if pause <= 500', () => {
          const profiler = getProfiler({ PROFILE_GC: true, HUNT_LONG_GC: true });
          const createSnapshotStub = sinon.stub(profiler, 'createSnapshot');
          stats.emit('stats', { pauseMS: 500 });
          clock.tick(6000);
          sinon.assert.notCalled(createSnapshotStub);
        });

        it('takes snapshot if pause > 500', () => {
          const profiler = getProfiler({ PROFILE_GC: true, HUNT_LONG_GC: true });
          const createSnapshotStub = sinon.stub(profiler, 'createSnapshot');
          stats.emit('stats', { pauseMS: 501 });
          clock.tick(6000);
          sinon.assert.calledOnce(createSnapshotStub);
          sinon.assert.calledWith(createSnapshotStub, 'LONG_GC_PAUSE');
        });
      });
    });
  });
});
