const { z } = require("zod");

const recurringRuleSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    dayOfMonth: z.number().int().min(1).max(31),
    categoryId: z.string().min(1)
});

module.exports = recurringRuleSchema;