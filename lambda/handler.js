const { DynamoDBClient, ConditionalCheckFailedException, Delete$ } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const categorySchema = require("./schemas/category.schema.js");

module.exports.handler = async (event) => {
    // eslint-disable-next-line no-undef
    console.log('Request event: ', event);

    const categoriesTableName = process.env.CATEGORIES_TABLE_NAME;
    const path = event.rawPath;
    const method = event.requestContext.http.method;
    const client = new DynamoDBClient({});
    const documentClient = DynamoDBDocumentClient.from(client);

    // /health branch
    if (method === "GET" && path === "/health") {
        return {
            statusCode: 200,
            headers: { "Content-Type": "text/plain" },
            body: "ok"
        }
    }

    // /me branch
    if (method === "GET" && path === "/me") {
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

    /* categories section */
    // GET /categories branch
    if (method === "GET" && path === "/categories") {
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

        if (!categoriesTableName) {
            return {
                statusCode: 500,
                body: "Internal Server Error!"
            }
        }
        
       try {
            const command = new QueryCommand({
                TableName: categoriesTableName,
                KeyConditionExpression: "userId = :uid",
                ExpressionAttributeValues: {
                    ":uid": sub
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
    if (method === "POST" && path === "/categories") {
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

        if (!categoriesTableName) {
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
        const categoryId = crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            const command = new PutCommand({
                TableName: categoriesTableName,
                Item: {
                    userId: userId,
                    categoryId,
                    name: validatedBody.name,
                    createdAt: now,
                    updatedAt: now
                }
            });

            const response = await documentClient.send(command);
            return {
                statusCode: 201,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: categoryId, name: validatedBody.name, createdAt: now, updatedAt: now })
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

    // /PATCH /categories/{id}} branch
    if (method === 'PATCH' && path.startsWith("/categories/")) {
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

        if (typeof id === "string" && id.trim().length > 0) {
            categoryId = id;
        }

        if (!categoryId) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        if (!categoriesTableName) {
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
                TableName: categoriesTableName,
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
    if (method === 'DELETE' && path.startsWith("/categories/")) {
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

        if (typeof id === "string" && id.trim().length > 0) {
            categoryId = id;
        }

        if (!categoryId) {
            return {
                statusCode: 400,
                body: "Bad Request!"
            }
        }

        if (!categoriesTableName) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "text/plain" },
                body: "Internal Server Error!"
            }
        }

        try {
            const command = new DeleteCommand({
                TableName: categoriesTableName,
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
    
    return {
        statusCode: 404,
        headers: { "Content-Type": "text/plain" },
        body: `Not Found!`
    };
}