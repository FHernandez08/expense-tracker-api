module.exports.handler = async (event) => {
    // eslint-disable-next-line no-undef
    console.log('Request event: ', event);
    
    return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: `Hello, CDK! You have hit ${event.rawPath}\n`
    };
}