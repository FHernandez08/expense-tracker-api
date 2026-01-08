import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwiv2integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'InfraQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // lambda function that points to the handler
    const httpApiLambda = new lambda.Function(this, 'LambdaHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'handler.handler',
      timeout: cdk.Duration.seconds(15),
      functionName: 'MyApiFunction'
    });

    // API Gateway HTTP API
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'ExpenseTrackerHttpApi',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
      },
    });

    // Lambda Integration
    const lambdaIntegration = new apigwiv2integrations.HttpLambdaIntegration('LambdaIntegration', httpApiLambda);

    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // Output the API base URL
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: httpApi.apiEndpoint + '/health',
      description: 'The endpoint URL for the HTTP API /health route',
    });
  }
}
