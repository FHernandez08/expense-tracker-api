# Expense Tracker API (AWS Serverless)

A cloud-native Expense Tracker REST API built using AWS serverless services and Infrastructure-as-Code.  
This project demonstrates production-style backend architecture including authentication, user-scoped data access, and API documentation.

---

## Live Links

- **Live Demo (Swagger UI):**  
  https://t5gbf3g304.execute-api.us-east-1.amazonaws.com/docs

- **Health Check:**  
  https://t5gbf3g304.execute-api.us-east-1.amazonaws.com/health

- **API Base URL:**  
  https://t5gbf3g304.execute-api.us-east-1.amazonaws.com
---

## Current Release

## Current Release
**Version:** v1.0 — Production-Ready Serverless Backend

This release includes the full core financial engine:
- Complete User Lifecycle (Sign-up, Email Verification, Login)
- Full Expense Tracking (Categories, Transactions, Budgets)
- Automated Monthly Summary Analytics
- Secure-by-Default Architecture

## Features (v1.0)
### Infrastructure
- AWS CDK (TypeScript) for 100% Infrastructure-as-Code
- API Gateway (HTTP API) with JWT Authorizer
- AWS Lambda (Node.js 20) with high-performance bundling
- Amazon Cognito Managed Identity Provider
- DynamoDB with Global Secondary Index (GSI) for time-series queries

### API Endpoints
**Public (Unauthenticated)**
- `GET /health` — Service health check
- `POST /signup` — User registration
- `POST /confirm` — Email verification
- `POST /login` — JWT token issuance

**Private (JWT Required)**
- `GET /summary` — Monthly budget vs. actual spending math
- `GET /categories` — User-defined spending categories
- `GET /transactions` — Financial record history
- `POST /budgets` — Category-specific spending limits

## API Documentation

The API is documented using OpenAPI and served via Swagger UI:

https://t5gbf3g304.execute-api.us-east-1.amazonaws.com/docs

The documentation includes:
- Request and response schemas
- Authentication requirements
- Endpoint descriptions

---

## Running Locally

Local development is supported for API iteration and testing.

High-level goals:
- Run the API locally
- Use the same request/response shapes as the deployed API
- Keep AWS CDK as the source of truth for infrastructure

Refer to project scripts and configuration for local setup.

---

## Testing the Deployed API

1. Create or use an existing Cognito user
2. Obtain a JWT access token
3. Include the token in requests

Recommended checks:
- `GET /summary?month=2026-02` returns a JSON object with total spent vs. budgeted.
- `POST /budgets` sets a limit that is immediately reflected in the summary math.

## Authorization Bearer <JWT>

Recommended checks:
- `GET /health` works without authentication
- `GET /me` rejects unauthenticated requests
- `POST /categories` creates a category
- `GET /categories` returns only the authenticated user’s data

---

## Roadmap

### v0.2
- Transactions resource
- Filters (date range, category)
- Pagination and sorting

### v1.0
- Monthly summaries
- Stronger validation and error handling
- Expanded test coverage
- CI pipeline (lint + tests)

### v2.0
- **AI-Powered Insights:** Integration with Amazon Bedrock for automatic transaction categorization.
- **Reporting Engine:** S3-based CSV export using Pre-signed URLs for secure data download.
- **Proactive Alerts:** AWS SNS integration for "Near Budget Limit" email/SMS notifications.
- **Observability:** Distributed tracing with AWS X-Ray to monitor cold starts and latency.

---

## Design Philosophy
- **Secure by Default:** Every endpoint is locked by a JWT authorizer at the infrastructure level. Public routes are managed as explicit exceptions.
- **Operational Excellence:** 100% of resources are managed via CDK; no manual "Click-Ops" in the AWS console.
- **Scalability:** Stateless Lambda functions ensure the API can scale from 0 to thousands of concurrent users instantly.

---

## Project Goals

This project demonstrates:
- Serverless API design on AWS
- Infrastructure-as-Code with AWS CDK
- Secure JWT-based authentication
- DynamoDB data modeling with ownership enforcement
- Professional API documentation using OpenAPI
