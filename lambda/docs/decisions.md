Architecture Decision Records (ADR)
===================================

### **1\. Managed Identity over Custom Auth**

*   **Decision:** Used **Amazon Cognito**.
    
*   **Why:** For a financial app, security is paramount. Delegating auth to a managed service provides secure password SRP protocols and email verification out of the box, reducing the "attack surface" of the application.
    

### **2\. "Secure by Default" API Posture**

*   **Decision:** Implemented a **Default JWT Authorizer**.
    
*   **Why:** To prevent accidental data exposure. Every route is locked by default. Public routes (like /login) must be explicitly "opted-out" using HttpNoneAuthorizer.
    

### **3\. NoSQL (DynamoDB) with GSI**

*   **Decision:** Used **DynamoDB** with a **Global Secondary Index**.
    
*   **Why:** Traditional SQL can become a bottleneck at scale. DynamoDB provides predictable millisecond performance. The GSI was added to support "Monthly Summaries," allowing us to query by date without performing expensive table scans.
    

### **4\. Self-Documenting API**

*   **Decision:** Served **Swagger UI** directly from the Lambda handler.
    
*   **Why:** To improve **Developer Experience (DX)**. It ensures the documentation is always in sync with the live code deployment.