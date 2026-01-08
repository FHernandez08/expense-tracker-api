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
