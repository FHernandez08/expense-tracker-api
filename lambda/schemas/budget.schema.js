const { z } = require("zod");

const budgetSchema = z.object({
    amount: z.number().positive(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    categoryId: z.string().min(1),
})

module.exports = budgetSchema;