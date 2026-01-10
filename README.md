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

### Authorization Enforcement
- Requests without a token are blocked by API Gateway
- Invalid tokens never reach Lambda
- Lambda includes a defensive guard for safety in case of misconfiguration

---

## Lambda Request Handling
A single Lambda handler processes multiple routes using manual routing.

### Routes
- `GET /health` - Public health check
- `GET /me` - Protected identity endpoint
- All other paths return 404 Not Found

### Defensive Authorization Guard
Even though authentication is enforced at the API Gateway level, Lambda includes a failsafe check to ensure:
- Authorizer context exists
- JWT and claims are present
- `sub` is a valid non-empty string
This prevents runtime errors and guarantees clean 401 Unauthorized responses in edge cases.

---

## Stack Outputs
The deployment provides the following outputs:
- **ApiEndpoint** - Base URL for the API
- **UserPoolId** - Cognito issuer reference
- **UserPoolClientId** - Used for authentication and JWT audience validation

--- 

## Verification
- `/health` returns `200 OK`
- `/me` without a token returns `401 Unauthorized`
- `/me` with a valid Cognito JWT returns `200 OK` with the user ID
- Unauthorized requests are rejected before lambda execution

---
---
---

## Request Validation

All write operations use **Zod** for runtime validation.

### Validation Flow
1. Ensure request body exists
2. Parse JSON safely
3. Validate schema using Zod
4. Reject invalid input before database access

Invalid requests return `400 Bad Request`.

---

## API Endpoints

All endpoints require a valid **Cognito JWT**.

---

### `GET /categories`

Returns all categories owned by the authenticated user.

#### Behavior
- Queries DynamoDB using the `userId` partition key
- Returns an empty array if no categories exist

#### Responses
- `200 OK`
- `401 Unauthorized`
- `500 Internal Server Error`

---

### `POST /categories`

Creates a new category for the authenticated user.

#### Request Body
```json
{
  "name": "Food"
}
```

#### Behavior

-   Validates input using Zod

-   Generates `categoryId` using `crypto.randomUUID()`

-   Sets `createdAt` and `updatedAt`

-   Writes item using `PutCommand`

#### Responses

-   `201 Created`

-   `400 Bad Request`

-   `401 Unauthorized`

-   `500 Internal Server Error`

* * * * *

### `PATCH /categories/{id}`

Updates an existing category owned by the user.

#### Request Body

`{
  "name": "Groceries"
}`

#### Behavior

-   Validates request body

-   Uses `UpdateCommand`

-   Uses `ConditionExpression` to prevent upserts

-   Ensures the category exists and belongs to the user

-   Returns updated item attributes

#### Responses

-   `200 OK`

-   `400 Bad Request`

-   `401 Unauthorized`

-   `404 Not Found`

-   `500 Internal Server Error`

* * * * *

### `DELETE /categories/{id}`

Deletes a category owned by the user.

#### Behavior

-   Uses `DeleteCommand`

-   Requires both `userId` and `categoryId`

-   Prevents deleting categories owned by other users

#### Responses

-   `204 No Content`

-   `401 Unauthorized`

-   `404 Not Found`

-   `500 Internal Server Error`

* * * * *

Error Handling Strategy
-----------------------

| Status Code | Meaning |
| --- | --- |
| `401` | Missing, invalid, or expired JWT |
| `400` | Invalid request body or parameters |
| `404` | Resource does not exist for the authenticated user |
| `500` | Unhandled server errors |

DynamoDB conditional failures are explicitly mapped to `404 Not Found` to prevent information leakage.

* * * * *

Deployment
----------

Infrastructure and services are deployed using **AWS CDK**.

`cdk deploy`

This deploys:

-   DynamoDB Categories table

-   API Lambda function

-   API Gateway HTTP API

-   Cognito JWT Authorizer

-   IAM permissions for DynamoDB access

* * * * *

Testing & Verification
----------------------

All routes were tested using:

-   `curl`

-   Real Amazon Cognito JWT tokens

### Verified Scenarios

-   Successful CRUD lifecycle

-   Empty category lists

-   Invalid request bodies

-   Expired tokens

-   Unauthorized access attempts

-   Cross-user access prevention

-   Conditional update and delete behavior


---
---
---