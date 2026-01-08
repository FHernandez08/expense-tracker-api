# Expense Tracker API

## Expense Tracker API is a serverless backend that provides authenticated users with transaction tracking, budgeting, analytics, recurring expense automation, and exports — deployed on AWS using Cognito, API Gateway, Lambda, DynamoDB, and S3 with infrastructure-as-code.

## AWS CDK Infrastructure Skeleton

### Goal

The goal of Day 2 was to establish a **cloud infrastructure foundation** using **AWS CDK** and deploy a minimal but real API endpoint to AWS.

This day focused entirely on:

- Infrastructure correctness  
- Authentication setup  
- End-to-end deployment verification  

No authentication, database, or business logic was added yet.

---

### What Was Built

Using **AWS CDK (TypeScript)**, the following infrastructure was created and deployed:

- **AWS Lambda**
  - Node.js runtime
  - Serves as the backend compute layer

- **API Gateway (HTTP API)**
  - Lightweight, low-latency HTTP API

- **Route**
  - `GET /health` → Lambda integration

- **CloudWatch Logs**
  - Automatic logging for Lambda execution

- **Stack Outputs**
  - API base URL printed after deployment for easy testing

This resulted in a **live `/health` endpoint** running in AWS that returns a successful response.

---

### Architecture Overview
Client (Browser / curl)

↓

API Gateway (HTTP API)

↓

AWS Lambda

↓

JSON Response

This validates:

- API Gateway → Lambda integration  
- Correct IAM permissions  
- Correct handler configuration  
- Correct response shape for HTTP API v2  

---

### Local vs Deployed Responsibility

A deliberate separation was established early:

**Local development**
- Express (planned for local testing and iteration)

**Deployed environment**
- Lambda handler as the production entrypoint

**Infrastructure**
- Defined entirely in `/infra` using AWS CDK

This mirrors real-world backend setups where **application logic and infrastructure are clearly separated**.

---

### Authentication & Permissions Notes

Authentication was handled using **AWS IAM Identity Center (SSO)**.

Two permission sets were used intentionally:

- **AdministratorAccess**
  - Used for `cdk bootstrap`
  - Required because bootstrap creates IAM roles

- **PowerUserAccess**
  - Intended for realistic day-to-day development
  - Too restrictive for bootstrap but useful later

This reflects real team workflows where **bootstrap and IAM changes are restricted**.

---

### Key Commands Used

```bash
# Authenticate via SSO
aws configure sso
aws sso login --profile <profile-name>

# Verify identity
aws sts get-caller-identity --profile <profile-name>

# Initialize CDK app
cdk init app --language typescript

# Bootstrap environment (one time per account/region)
cdk bootstrap --profile <admin-profile>

# Synthesize CloudFormation template
cdk synth

# Deploy infrastructure
cdk deploy --profile <profile-name>
```
---
---
---

# Authentication & Identity Infrastructure

This service uses **JWT-based authentication** with **Amazon Cognito**, enforced at the **API Gateway** level and consumed by **AWS Lambda**.

Authentication is handled as infrastructure-first, with minimal and defensive application logic.

## Cognito User Management

A **Cognito User Pool** is used as the identity provider.

- Supports username and email sign-in
- Enforces strong password requirements
- Automatically verifies user email addresses
- Issues JWTs (`IdToken`, `AccessToken`) upon authentication

A **User Pool Client** is configured for backend and API testing use.

- Authentication flow enabled: `USER_PASSWORD_AUTH`
- Client ID is used as the JWT audience
- No client secret (public client)

---

## API Gateway JWT Authorization

API Gateway HTTP API is configured with a **JWT Authorizer** backed by Cognito.

- JWTs are validated before requests reach Lambda
- Unauthorized requests are rejected with **401 Unauthorized**
- Validated claims are injected into the Lambda request context

### Authorizer Configuration
- **Issuer:** Cognito User Pool
- **Audience:** Cognito User Pool Client ID
- **Identity Source:** `Authorization` header (`Bearer <token>`)

---

## Protected Endpoint: `GET /me`

A protected endpoint is exposed to return the authenticated user’s identity.

### Behavior
- Requires a valid JWT
- Reads user identity from Cognito claims
- Returns the user’s Cognito `sub` value

### Response
```json
{
  "userId": "<cognito-sub>"
}
```
---
---
---
