/*
 * Lambda function that implements the create licence functionality
 */
const { Logger, injectLambdaContext } = require('@aws-lambda-powertools/logger');
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const { Metrics, logMetrics } = require('@aws-lambda-powertools/metrics');
const middy = require('@middy/core');
const { addBalance } = require('./helper/utils');
const ErrorNotFound = require('./lib/ErrorNotFound');

//  Params fetched from the env vars
const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics();

tracer.captureAWS(require('aws-sdk'));

const handler = async (event) => {
  const { guid } = event.pathParameters;
  const { amountToAdd } = JSON.parse(event.body);

  try {
    // updateFunc
    const response = await addBalance(guid, amountToAdd, logger);
    // getTheData
    const wallet = response
    
    return {
      statusCode: 200,
      body: JSON.stringify(wallet),
    }
  } catch (error) {
    if (error instanceof ErrorNotFound) {
      return error.getHttpResponse();
    }
    logger.error(`Error returned: ${error}`);
    const errorBody = {
      status: 500,
      title: error.name,
      detail: error.message,
    };
    return {
      statusCode: 500,
      body: JSON.stringify(errorBody),
    };    
  }
};

module.exports.handler = middy(handler)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics, { captureColdStartMetric: true }));
