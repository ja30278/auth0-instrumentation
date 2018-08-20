const jaeger = require('jaeger-client');
const ZipkinOpentracer = require('zipkin-javascript-opentracing');

exports.create = (agent, pkg, env) => {
  const serviceName = env.SERVICE_NAME ? env.SERVICE_NAME : pkg.name;

  const zipconfig = {
    serviceName: serviceName,
    endpoint: 'http://zipkin:9411',
    kind: 'server'
  };

  return new ZipkinOpentracer(zipconfig);

  const config = {
    serviceName: serviceName,
    reporter: {
      agentHost: env.TRACE_AGENT_HOST,
    },
    sampler: {
      type: 'const',
      param: 1,
    }
  };

  const options = {
    logger: agent.logger
  };
  return jaeger.initTracer(config, options);
};

