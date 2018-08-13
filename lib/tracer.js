const tracing = require('opentracing');
const jaeger = require('jaeger-client');

module.exports = function Tracer(agent, pkg, env) {
  const serviceName = env.SERVICE_NAME ? env.SERVICE_NAME : pkg.name;
  let config = {
    serviceName: serviceName,
    reporter: {
      agenthost: env.TRACE_AGENT_HOST,
    },
    sampler: {
      type: 'const',
      param: 1,
    }
  };

  let options = {
    logger: agent.logger
  };

  return jaeger.initTracer(config, options);
};
