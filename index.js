var stubs = require('./lib/stubs');
var Logger = require('./lib/logger');
var ErrorReporter = require('./lib/error_reporter');
var Metrics = require('./lib/metrics');
var Profiler = require('./lib/profiler');
var Tracer = require('./lib/tracer');


module.exports = {
  logger: stubs.logger,
  errorReporter: stubs.errorReporter,
  metrics: stubs.metrics,
  profiler: stubs.profiler,
  tracer: stubs.emptyTracer,
  initialized: false,

  init: function(pkg, env, serializers, params) {
    if (this.initialized) { return; }

    this.logger = Logger(pkg, env, serializers);
    this.errorReporter = ErrorReporter(pkg, env);
    this.metrics = Metrics(pkg, env);
    this.profiler = new Profiler(this, pkg, env);

    this.tracer = Tracer(this, pkg, env);
    this.initialized = true;

    if (params && params.fileRotationSignal && env.LOG_FILE) {
      process.on(params.fileRotationSignal, () => {
        this.logger.reopenFileStreams();
        this.logger.info('The log file has been rotated.');
      });
    }
  }
};
