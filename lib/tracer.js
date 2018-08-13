const tracing = require('opentracing');
const jaeger = require('jaeger-client');

function Tracer(agent, pkg, env) {
  const serviceName = env.SERVICE_NAME ? env.SERVICE_NAME : pkg.name;
  let config = {
    serviceName: serviceName
  };

  let options = {
    logger: agent.logger
  };

  return jaeger.initTracer(config, options);
};
