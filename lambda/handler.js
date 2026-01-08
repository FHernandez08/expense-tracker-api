module.exports.handler = async (event) => {
    // eslint-disable-next-line no-undef
    console.log('Request event: ', event);

    const path = event.rawPath;
    const method = event.requestContext.http.method;

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
    
    return {
        statusCode: 404,
        headers: { "Content-Type": "text/plain" },
        body: `Not Found!`
    };
}