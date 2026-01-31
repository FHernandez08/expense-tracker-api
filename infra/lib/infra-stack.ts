import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwiv2integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as s3 from 'aws-cdk-lib/aws-s3';

interface InfraStackProps extends cdk.StackProps {
  stage: string;
  namePrefix: string;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const { stage, namePrefix } = props;

    /* ------------------ Data Layer ------------------ */
    // create DynamoDB Categories table
    const categoriesTable = new dynamodb.Table(this, 'ETCategoriesTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'categoryId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: `${namePrefix}-categories`,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // adding private S3 bucket
    const privateBucket = new s3.Bucket(this, 'csvExportsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.KMS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.hours(24),
        }
      ]
    });

    /* ------------------ Config Layer ------------------ */
    new ssm.StringParameter(this, 'devParameter', {
      parameterName: `/${namePrefix}/table-name`,
      stringValue: categoriesTable.tableName,
      description: 'A parameter used inside the SSM Parameter store for the APIs environment',
    });

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

    /* ------------------ Compute Layer ------------------ */
    // lambda function that points to the handler
    const httpApiLambda = new lambda.Function(this, 'LambdaHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      handler: 'handler.handler',
      timeout: cdk.Duration.seconds(15),
      environment: {
        CATEGORIES_TABLE_NAME: categoriesTable.tableName,
        STAGE: stage,
      }
    });

    // Granted Lambda permissions for categories table
    categoriesTable.grantReadWriteData(httpApiLambda);

    /* ------------------ API Layer ------------------ */
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

    /* -------- Routes ----------*/
    // GET /health route
    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // GET /openapi.yaml route
    httpApi.addRoutes({
      path: '/openapi.yaml',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration
    });

    // GET /docs route
    httpApi.addRoutes({
      path: '/docs',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration
    });

    // GET /me route
    httpApi.addRoutes({
      path: '/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
      authorizer: authorizer,
    });

    /* ----- categories routes ----- */
    // POST /categories route
    httpApi.addRoutes({
      path: '/categories',
      methods: [apigwv2.HttpMethod.POST],
      integration: lambdaIntegration,
      authorizer: authorizer,
    });

    // GET /categories route
    httpApi.addRoutes({
      path: '/categories',
      methods: [apigwv2.HttpMethod.GET],
      integration: lambdaIntegration,
      authorizer: authorizer,
    });

    // PATCH /categories/{id} route
    httpApi.addRoutes({
      path: '/categories/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: lambdaIntegration,
      authorizer: authorizer,
    });

    // DELETE /categories/{id} route
    httpApi.addRoutes({
      path: '/categories/{id}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: lambdaIntegration,
      authorizer: authorizer,
    });

    /* -------- OUTPUTS ----------*/

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
