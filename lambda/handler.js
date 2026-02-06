const { DynamoDBClient, ConditionalCheckFailedException, Delete$ } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");

const categorySchema = require("./schemas/category.schema.js");
const budgetSchema = require("./schemas/budget.schema.js");
const transactionSchema = require("./schemas/transaction.schema.js");
const recurringRuleSchema = require("./schemas/rule.schema.js");
const fs = require("fs");
const path = require("path");

const cognitoClient = new CognitoIdentityProviderClient({});

module.exports.handler = async (event) => {
    console.log('Request event: ', event);

    const expenseTrackerTableName = process.env.EXPENSE_TRACKER_TABLE;
    const rawPath = event.rawPath;
    const method = event.requestContext.http.method;
    const client = new DynamoDBClient({});
    const documentClient = DynamoDBDocumentClient.from(client);

    // /health branch
    if (method === "GET" && rawPath === "/health") {
        return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain" },
            body: "ok"
        }
    };

    // GET /openapi.yaml branch
    if (method === "GET" && rawPath === "/openapi.yaml") {
        try {
            const specPath = path.join(__dirname, "docs", "openapi.yaml");
            const yamlText = fs.readFileSync(specPath, "utf-8");

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "text/yaml; charset=utf-8",
                    "Cache-Control": "no-store",
                },
                body: yamlText,
            };

        } catch (err) {
            console.log("Failed to read openapi.yaml", err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
                body: "Internal Server Error",
            };
        }
    }

    // GET /docs branch (public) - Swagger UI (CDN)
    if (method === "GET" && (rawPath === "/docs" || rawPath === "/docs/")) {
    const html = `<!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Expense Tracker API Docs</title>
            <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
            <style>
            body { margin: 0; }
            .topbar { display: none; }
            </style>
        </head>
        <body>
            <div id="swagger-ui"></div>

            <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
            <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js"></script>
            <script>
            window.onload = () => {
                window.ui = SwaggerUIBundle({
                url: "/openapi.yaml",
                dom_id: "#swagger-ui",
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                layout: "StandaloneLayout"
                });
            };
            </script>
        </body>
        </html>`;

        return {
            statusCode: 200,
            headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            },
            body: html,
        };
    }


    // GET /me branch
    if (method === "GET" && rawPath === "/me") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;

        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const successBody = { "userId": sub };

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(successBody)
        };
    };

    /* ---------- onboarding section ---------- */
    // POST /signup branch
    if (method === "POST" && rawPath === "/signup") {
        let body;
        try {
            body = JSON.parse(event.body);
        }
        catch (e) {
            return { statusCode: 400, body: "Invalid JSON" };
        }

        const { email, password } = body;

        try {
            const command = new SignUpCommand({
                ClientId: process.env.COGNITO_CLIENT_ID,
                Username: email,
                Password: password,
                UserAttributes: [
                    { Name: "email", Value: email }
                ],
            });

            await cognitoClient.send(command);

            return {
                statusCode: 201,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Regsitration successful. Please check your email for a confirmation code."
                })
            };
        } catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: err.message || "Registration failed"
            }
        }
    }

    // POST /confirm branch
    if (method === "POST" && rawPath === "/confirm") {
        const { email, code } = JSON.parse(event.body);

        try {
            const command = new ConfirmSignUpCommand({
                ClientId: process.env.COGNITO_CLIENT_ID,
                Username: email,
                ConfirmationCode: code,
            });

            await cognitoClient.send(command);

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "Account confirmed! You can now log in." })
            };
        } catch (err) {
            return { statusCode: 400, body: err.message };
        }
    }

    // POST /login branch
    if (method === "POST" && rawPath === "/login") {
        const { email, password } = JSON.parse(event.body);

        try {
            const command = new InitiateAuthCommand({
                AuthFlow: "USER_PASSWORD_AUTH",
                ClientId: process.env.COGNITO_CLIENT_ID,
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password,
                }
            });

            const response = await cognitoClient.send(command);

            return {
                statusCode: 200,
                headers: { "Content-Type":  "application/json" },
                body: JSON.stringify({
                    idToken: response.AuthenticationResult.IdToken,
                    refreshToken: response.AuthenticationResult.RefreshToken,
                    expiresIn: response.AuthenticationResult.ExpiresIn
                })
            };
        } catch (err) {
            return { statusCode: 401, body: "Invalid email or password" };
        }
    }

    /* ---------- categories section ---------- */
    // GET /categories branch
    if (method === "GET" && rawPath === "/categories") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                body: "Internal Server Error!"
            }
        }
        
       try {
            const command = new QueryCommand({
                TableName: expenseTrackerTableName,
                KeyConditionExpression: "userId = :uid AND begins_with(categoryId, :prefix)",
                ExpressionAttributeValues: {
                    ":uid": sub,
                    ":prefix": "CAT#"
                },
            })

            const response =  await documentClient.send(command);
            const items = response.Items ?? [];
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items })
            };
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }
    }

    // POST /categories branch
    if (method === "POST" && rawPath === "/categories") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        if (!event.body) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        let parsedBody;

        try {
            parsedBody = JSON.parse(event.body);
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            }
        }

        const validationResult = categorySchema.safeParse(parsedBody);

        if (!validationResult.success) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            };
        };

        const validatedBody = validationResult.data;
        const sortKey = "CAT#" + crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            const command = new PutCommand({
                TableName: expenseTrackerTableName,
                Item: {
                    userId: userId,
                    categoryId: sortKey,
                    name: validatedBody.name,
                    createdAt: now,
                    updatedAt: now
                }
            });

            const response = await documentClient.send(command);
            return {
                statusCode: 201,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: sortKey, name: validatedBody.name, createdAt: now, updatedAt: now })
            }
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }

    // /PATCH /categories/{id} branch
    if (method === 'PATCH' && rawPath.startsWith("/categories/")) {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;
        const id = event.pathParameters?.id;
        let categoryId;

        const finalId = id.startsWith("CAT#") ? id : "CAT#" + id;

        if (typeof id === "string" && id.trim().length > 0) {
            categoryId = finalId;
        }

        if (!categoryId) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        if (!event.body) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        let parsedBody;

        try {
            parsedBody = JSON.parse(event.body);
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            }
        }

        const validationResult = categorySchema.safeParse(parsedBody);

        if (!validationResult.success) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            };
        };

        const validatedBody = validationResult.data;
        const now = new Date().toISOString();

        try {
            const command = new UpdateCommand({
                TableName: expenseTrackerTableName,
                Key: {
                    userId: userId,
                    categoryId: categoryId
                },
                UpdateExpression: "SET #n = :name, updatedAt = :now",
                ExpressionAttributeNames: {
                    "#n": "name"
                },
                ExpressionAttributeValues: {
                    ":name": validatedBody.name,
                    ":now": now,
                },
                ConditionExpression: "attribute_exists(categoryId)",
                ReturnValues: "ALL_NEW"
            })

            const response = await documentClient.send(command)
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response.Attributes)
            }
        }
        catch (err) {
            console.log(err)

            if (err.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 404,
                    headers: { "Content-Type": "text/plain" },
                    body: "Not Found"
                }
            }
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }
    
    // DELETE /categories/{id} branch
    if (method === 'DELETE' && rawPath.startsWith("/categories/")) {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;
        const id = event.pathParameters?.id;
        let categoryId;

        const finalId = id.startsWith("CAT#") ? id : "CAT#" + id;

        if (typeof id === "string" && id.trim().length > 0) {
            categoryId = finalId;
        }

        if (!categoryId) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        try {
            const command = new DeleteCommand({
                TableName: expenseTrackerTableName,
                Key: {
                    userId: userId,
                    categoryId: categoryId,
                },
                ConditionExpression: "attribute_exists(categoryId)"
            })

            const response = await documentClient.send(command);
            return {
                statusCode: 204,
                body: "",
            }
        } 
        catch (err) {
            console.log(err)

            if (err.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 404,
                    headers: { "Content-Type": "text/plain" },
                    body: "Not Found"
                }
            }
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }

    /* ---------- budgets section ---------- */
    // GET /budgets branch
    if (method === "GET" && rawPath === "/budgets") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                body: "Internal Server Error!"
            }
        }

        const month = event.queryStringParameters?.month;
        const prefix = month ? `BUD#${month}` : "BUD#";
        
        try {
            const command = new QueryCommand({
                TableName: expenseTrackerTableName,
                KeyConditionExpression: "userId = :uid AND begins_with(categoryId, :p)",
                ExpressionAttributeValues: {
                    ":uid": sub,
                    ":p": prefix
                },
            })

            const response =  await documentClient.send(command);
            const items = response.Items ?? [];
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items })
            };
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }
    }

    // POST /budgets branch
    if (method === "POST" && rawPath === "/budgets") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        if (!event.body) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        let parsedBody;

        try {
            parsedBody = JSON.parse(event.body);
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            }
        }

        const validationResult = budgetSchema.safeParse(parsedBody);

        if (!validationResult.success) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            };
        };

        const validatedBody = validationResult.data;
        const sortKey = "BUD#" + validatedBody.month + "#" + validatedBody.categoryId;
        const now = new Date().toISOString();

        try {
            const command = new PutCommand({
                TableName: expenseTrackerTableName,
                Item: {
                    userId: userId,
                    categoryId: sortKey,
                    amount: validatedBody.amount,
                    createdAt: now,
                    updatedAt: now
                }
            });

            const response = await documentClient.send(command);
            return {
                statusCode: 201,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: sortKey, name: validatedBody.name, createdAt: now, updatedAt: now })
            }
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }

    // PATCH /budgets/{id} branch
    if (method === "PATCH" && rawPath.startsWith("/budgets/")) {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;
        const id = event.pathParameters?.id;
        let categoryId;

        const finalId = id.startsWith("BUD#") ? id : "BUD#" + id;

        if (typeof id === "string" && id.trim().length > 0) {
            categoryId = finalId;
        }

        if (!categoryId) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        if (!event.body) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        let parsedBody;

        try {
            parsedBody = JSON.parse(event.body);
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            }
        }

        const validationResult = budgetSchema.safeParse(parsedBody);

        if (!validationResult.success) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            };
        };

        const validatedBody = validationResult.data;
        const now = new Date().toISOString();

        try {
            const command = new UpdateCommand({
                TableName: expenseTrackerTableName,
                Key: {
                    userId: userId,
                    categoryId: categoryId
                },
                UpdateExpression: "SET #a = :amount, updatedAt = :now",
                ExpressionAttributeValues: {
                    ":amount": validatedBody.amount,
                    ":now": now,
                },
                ConditionExpression: "attribute_exists(categoryId)",
                ReturnValues: "ALL_NEW"
            })

            const response = await documentClient.send(command)
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response.Attributes)
            }
        }
        catch (err) {
            console.log(err)

            if (err.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 404,
                    headers: { "Content-Type": "text/plain" },
                    body: "Not Found"
                }
            }
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }

    // DELETE /budgets/{id} branch
    if (method === "DELETE" && rawPath.startsWith("/budgets/")) {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;
        const id = event.pathParameters?.id;
        let categoryId;

        const finalId = id.startsWith("BUD#") ? id : "BUD#" + id;

        if (typeof id === "string" && id.trim().length > 0) {
            categoryId = finalId;
        }

        if (!categoryId) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        try {
            const command = new DeleteCommand({
                TableName: expenseTrackerTableName,
                Key: {
                    userId: userId,
                    categoryId: categoryId,
                },
                ConditionExpression: "attribute_exists(categoryId)"
            })

            const response = await documentClient.send(command);
            return {
                statusCode: 204,
                body: "",
            }
        } 
        catch (err) {
            console.log(err)

            if (err.name === "ConditionalCheckFailedException") {
                return {
                    statusCode: 404,
                    headers: { "Content-Type": "text/plain" },
                    body: "Not Found"
                }
            }
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }

    /* ---------- transactions section ---------- */
    // GET /transactions branch
    if (method === "GET" && rawPath === "/transactions") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                body: "Internal Server Error!"
            }
        }
        
        try {
            const command = new QueryCommand({
                TableName: expenseTrackerTableName,
                IndexName: "UserDateIndex",
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: {
                    ":uid": sub,
                },
                ScanIndexForward: false
            });

            const response =  await documentClient.send(command);
            const items = response.Items ?? [];
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items })
            };
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }
    }

    // POST /transactions branch
    if (method === "POST" && rawPath === "/transactions") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        if (!event.body) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        let parsedBody;

        try {
            parsedBody = JSON.parse(event.body);
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            }
        }

        const validationResult = transactionSchema.safeParse(parsedBody);

        if (!validationResult.success) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            };
        };

        const validatedBody = validationResult.data;
        const sortKey = "TX#" + crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            const command = new PutCommand({
                TableName: expenseTrackerTableName,
                Item: {
                    userId: userId,
                    categoryId: sortKey,
                    amount: validatedBody.amount,
                    description: validatedBody.description,
                    occurredAt: validatedBody.occurredAt,
                    linkedCategoryId: validatedBody.categoryId,
                    createdAt: now,
                    updatedAt: now
                }
            });

            const response = await documentClient.send(command);
            return {
                statusCode: 201,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: sortKey,
                    description: validatedBody.description,
                    amount: validatedBody.amount,
                    occurredAt: validatedBody.occurredAt,
                    createdAt: now,
                    updatedAt: now
                 })
            }
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error"
            }
        }
    }

    /* ---------- rules section ---------- */
    // POST /rules branch
    if (method === "POST" && rawPath === "/rules") {
        if (!event.requestContext.authorizer || !event.requestContext.authorizer.jwt || !event.requestContext.authorizer.jwt.claims) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const sub = event.requestContext.authorizer.jwt.claims.sub;
        if (typeof sub !== "string" || sub.trim().length === 0) {
            return {
                statusCode: 401,
                body: "Unauthorized!"
            }
        }

        const userId = sub;

        if (!expenseTrackerTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        if (!event.body) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        let parsedBody;

        try {
            parsedBody = JSON.parse(event.body);
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 400,
                headers: { "Content-Type": "text/plain" },
                body: "Bad Request"
            }
        }

        const validationResult = recurringRuleSchema.safeParse(parsedBody);
        if (!validationResult.success) return { statusCode: 400, body: "Bad Request" };

        const validatedBody = validationResult.data;
        const ruleId = "RULE#" + crypto.randomUUID();

        await documentClient.send(new PutCommand({
            TableName: expenseTrackerTableName,
            Item: {
                userId: userId,
                categoryId: ruleId,
                amount: validatedBody.amount,
                description: validatedBody.description,
                dayOfMonth: validatedBody.dayOfMonth,
                linkedCategoryId: validatedBody.categoryId,
                createdAt: new Date().toISOString()
            }
        }));

        return { statusCode: 201, body: JSON.stringify({ id: ruleId }) };
    }

    /* ---------- summary section ---------- */
    // GET /summary branch
    if (method === "GET" && rawPath === "/summary") {
        const sub = event.requestContext.authorizer?.jwt?.claims?.sub;
        const month = event.queryStringParameters?.month;

        if (!sub || !month) {
            return {
                statusCode: 400,
                body: "Missing User ID or Month"
            };
        }

        try {
            const [budgetData, transactionData] = await Promise.all([
                documentClient.send(new QueryCommand({
                    TableName: expenseTrackerTableName,
                    KeyConditionExpression: "userId = :uid AND begins_with(categoryId, :p)",
                    ExpressionAttributeValues: {
                        ":uid": sub,
                        ":p": `BUD#${month}`
                    }
                })),

                documentClient.send(new QueryCommand({
                    TableName: expenseTrackerTableName,
                    IndexName: "UserDateIndex",
                    KeyConditionExpression: "userId = :uid AND begins_with(occurredAt, :m)",
                    ExpressionAttributeValues: {
                        ":uid": sub,
                        ":m": month
                    }
                }))
            ]);

            const budgets = budgetData.Items ?? [];
            const transactions = transactionData.Items ?? [];

            const totalBudgeted = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
            const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month,
                    totalBudgeted,
                    totalSpent,
                    remaining: totalBudgeted - totalSpent,
                    transactionCount: transactions.length,
                    budgetCount: budgets.length
                })
            };
        }
        catch (err) {
            console.log(err);
            return {
                statusCode: 500,
                body: "Internal Server Error"
            };
        }
    };
    
    return {
        statusCode: 404,
        headers: { "Content-Type": "text/plain" },
        body: `Not Found!`
    };
}