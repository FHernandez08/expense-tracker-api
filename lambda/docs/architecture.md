System Architecture
===================

This document outlines the high-level design and data flow of the Serverless Expense Tracker.

### **The Stack**

*   **Infrastructure as Code (IaC):** AWS CDK (TypeScript)
    
*   **API Layer:** AWS API Gateway (HTTP API)
    
*   **Compute:** AWS Lambda (Node.js 20.x)
    
*   **Authentication:** Amazon Cognito (JWT)
    
*   **Database:** Amazon DynamoDB (NoSQL)
    
*   **Storage:** Amazon S3 (CSV Exports)
    

### **Request Flow**

1.  **Identity:** User authenticates via **Cognito** and receives a **JWT**.
    
2.  **Gatekeeper:** **API Gateway** validates the JWT via a native Authorizer.
    
3.  **Logic:** **Lambda** processes the request. It extracts the userId from the token claims to ensure data isolation.
    
4.  **Storage:** **DynamoDB** stores records. A **Global Secondary Index (GSI)** on userId + occurredAt allows for efficient monthly filtering.