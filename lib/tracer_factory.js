exports.create = (agent, pkg, env) {
  const serviceName = env.SERVICE_NAME ? env.SERVICE_NAME : pkg.name;

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

