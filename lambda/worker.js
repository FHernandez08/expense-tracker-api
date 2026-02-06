const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.EXPENSE_TRACKER_TABLE;

module.exports.handler = async () => {
    const today = new Date();
    const currentDay = today.getDate(); // e.g., 6

    try {
        // 1. Find all rules that match today's day of the month
        const scanCommand = new ScanCommand({
            TableName: tableName,
            FilterExpression: "dayOfMonth = :d AND begins_with(categoryId, :prefix)",
            ExpressionAttributeValues: {
                ":d": currentDay,
                ":prefix": "RULE#"
            }
        });

        const { Items = [] } = await documentClient.send(scanCommand);

        // 2. Create a transaction for each matching rule
        const promises = Items.map(rule => {
            const txId = "TX#" + crypto.randomUUID();
            const now = new Date().toISOString();

            return documentClient.send(new PutCommand({
                TableName: tableName,
                Item: {
                    userId: rule.userId,
                    categoryId: txId, // SK
                    amount: rule.amount,
                    description: rule.description + " (Recurring)",
                    occurredAt: now, // This triggers the GSI!
                    linkedCategoryId: rule.linkedCategoryId,
                    createdAt: now,
                    updatedAt: now
                }
            }));
        });

        await Promise.all(promises);
        console.log(`Successfully processed ${Items.length} recurring expenses.`);

    } catch (err) {
        console.error("Worker Error:", err);
    }
};