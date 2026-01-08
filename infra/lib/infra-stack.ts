import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwiv2integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';


// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'InfraQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // auth section //
    // create Cognito User Pool
    const userPool = new UserPool(this, 'ExpenseTrackerUserPool', {
      signInAliases: {
        email: true,
        username: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      autoVerify: {
        email: true,
      },
    });

    // Cognito User Pool Client
    const userPoolClient = userPool.addClient('ExpenseTrackerClient', {
      authFlows: {
        userPassword: true,
      },
    });

    // lambda function that points to the handler
    const httpApiLambda = new lambda.Function(this, 'LambdaHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'handler.handler',
      timeout: cdk.Duration.seconds(15),
      functionName: 'MyApiFunction'
    });

    // API Gateway HTTP API created
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'ExpenseTrackerHttpApi',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
      },
    });

    // API Gateway JWT Authorizer
    const issuer = `https://cognito-idp.us-east-1.amazonaws.com/${userPool.userPoolId}`;
    const audience = userPoolClient.userPoolClientId;

    const authorizer = new HttpJwtAuthorizer('ExpenseTrackerAuthorizer', issuer, {
      jwtAudience: [audience],
      identitySource: ["$request.header.Authorization"],
    });

    // Lambda Integration
    const lambdaIntegration = new apigwiv2integrations.HttpLambdaIntegration('LambdaIntegration', httpApiLambda);

    // GET /health route
    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // GET /me route
    httpApi.addRoutes({
      path: '/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
      authorizer: authorizer
    })

    // Output the API base URL
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: httpApi.apiEndpoint + '/health',
      description: 'The endpoint URL for the HTTP API /health route',
    });

    // Output for UserPoolId
    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: userPool.userPoolId,
      description: 'Pool ID string',
    });

    // Output for UserPoolClientId
    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', {
      value: userPoolClient.userPoolClientId,
      description: 'Client ID string',
    });
  }
}
