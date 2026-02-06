const { z } = require("zod");

const transactionSchema = z.object({
    amount: z.number().positive(),
    categoryId: z.string().min(1),
    description: z.string(),
    occurredAt: z.string()
})

module.exports = transactionSchema;