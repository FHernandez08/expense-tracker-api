module.exports.worker = async (event) => {
    console.log("Worker waking up!", JSON.stringify(event));
    return { statusCode: 200 };
}