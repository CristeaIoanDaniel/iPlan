const {z} = require('zod');
const createItinerarySchema = z.object({
    body:z.object({
        title:z
        .string({required_error:'Title is required'})
        .min(3,{message:'Title must be at least 3 characters long'})
        .max(255,'Title cannot exceed 255 characters'),
        description:z.string().optional(),
        start_date:z
        .string({required_error:'Start date is required'})
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
        end_date:z
        .string({required_error:'End date is required'})
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
        is_public: z.boolean().default(false),
    }).refine(
        (data) => new Date(data.end_date) >= new Date(data.start_date),
        {
            message:'End date must be on or after start date',
            path:['end_date'],
        }
    ),
});
module.exports= {
    createItinerarySchema,
};