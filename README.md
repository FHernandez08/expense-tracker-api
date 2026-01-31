# Expense Tracker API (AWS Serverless)

A cloud-native Expense Tracker REST API built using AWS serverless services and Infrastructure-as-Code.  
This project demonstrates production-style backend architecture including authentication, user-scoped data access, and API documentation.

---

## Live Links

- **Live Demo (Swagger UI):**  
  https://nll100bzb7.execute-api.us-east-1.amazonaws.com/docs

- **Health Check:**  
  https://nll100bzb7.execute-api.us-east-1.amazonaws.com/health

- **API Base URL:**  
  https://nll100bzb7.execute-api.us-east-1.amazonaws.com

---

## Current Release

**Version:** v0.1 — Initial Portfolio Release

This release intentionally focuses on a small but complete vertical slice:
- Deployed AWS infrastructure
- Authentication via Cognito
- A real domain resource backed by DynamoDB
- OpenAPI documentation

---

## Features (v0.1)

### Infrastructure
- AWS CDK (TypeScript)
- API Gateway (HTTP API)
- AWS Lambda (Node.js)
- Amazon Cognito (JWT authentication)
- DynamoDB (Categories)
- CloudWatch logging

### API Endpoints

**Public**
- `GET /health` — service health check

**Authenticated**
- `GET /me` — returns authenticated user identity
- `GET /categories` — list user categories
- `POST /categories` — create a category for the user

---

## Architecture Overview
Client (Browser / curl / frontend)
↓
API Gateway (HTTP API)
↓
Lambda (request handling + auth context)
↓
DynamoDB (user-scoped data)


**Authentication Flow**
- Users authenticate via Amazon Cognito
- Cognito issues a JWT access token
- API Gateway validates JWTs
- Lambda receives the authenticated user (`sub`) and enforces ownership

---

## API Documentation

The API is documented using OpenAPI and served via Swagger UI:

https://nll100bzb7.execute-api.us-east-1.amazonaws.com/docs

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
3. Include the token in requests:

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

---

## Project Goals

This project demonstrates:
- Serverless API design on AWS
- Infrastructure-as-Code with AWS CDK
- Secure JWT-based authentication
- DynamoDB data modeling with ownership enforcement
- Professional API documentation using OpenAPI
