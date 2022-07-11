/*
 * Lambda function that implements the create licence functionality
 */
const { Logger, injectLambdaContext } = require('@aws-lambda-powertools/logger');
const { Tracer, captureLambdaHandler } = require('@aws-lambda-powertools/tracer');
const { Metrics, MetricUnits, logMetrics } = require('@aws-lambda-powertools/metrics');
const middy = require('@middy/core');
const dateFormat = require('dateformat');
const { createWallet } = require('./helper/utils');
const CustomError = require('./lib/CustomError');

//  Params fetched from the env vars
const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics();

tracer.captureAWS(require('aws-sdk'));

const handler = async (event) => {
  const {
    email, name,
  } = JSON.parse(event.body);

  try {
    const eventInfo = [{ eventName: 'WalletHolderCreated', eventDate: dateFormat(new Date(), 'isoDateTime') }];
    const response = await createWallet(
      email, name, eventInfo, logger,
    );

    metrics.addMetric('createWalletSucceeded', MetricUnits.Count, 1);

    return {
      statusCode: 201,
      body: JSON.stringify(response),
    };
  } catch (error) {
    metrics.addMetric('createWalletFailed', MetricUnits.Count, 1);

    if (error instanceof CustomError) {
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
