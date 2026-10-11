const {z} = require('zod');
const date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((value) => {
        const parsedDate = new Date(`${value}T00:00:00.000Z`);
        return !Number.isNaN(parsedDate.valueOf())
            && parsedDate.toISOString().slice(0, 10) === value;
    }, 'Date must be a valid calendar date');

const itineraryFields = {
    title: z.string()
        .trim()
        .min(3, 'Title must be at least 3 characters long')
        .max(255, 'Title cannot exceed 255 characters'),
    description: z.string().trim().max(5000, 'Description cannot exceed 5000 characters'),
    destination: z.string()
        .trim()
        .min(1, 'Destination is required')
        .max(255, 'Destination cannot exceed 255 characters'),
    start_date: date,
    end_date: date,
    is_public: z.boolean(),
};

const createItineraryBody = z.object({
    ...itineraryFields,
    description: itineraryFields.description.optional(),
    is_public: itineraryFields.is_public.default(false),
}).strict().refine(
    (data) => data.end_date >= data.start_date,
    {
        message: 'End date must be on or after start date',
        path: ['end_date'],
    },
);

const updateItineraryBody = z.object({
    ...itineraryFields,
}).partial().strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one itinerary field must be provided',
    })
    .refine(
        (data) => !data.start_date || !data.end_date || data.end_date >= data.start_date,
        {
            message: 'End date must be on or after start date',
            path: ['end_date'],
        },
    );

const itineraryIdParams = z.object({
    id: z.string().uuid('Itinerary ID must be a valid UUID'),
}).strict();

const createItinerarySchema = z.object({
    body: createItineraryBody,
});
const updateItinerarySchema = z.object({
    body: updateItineraryBody,
    params: itineraryIdParams,
});
const itineraryIdSchema = z.object({
    params: itineraryIdParams,
});

module.exports= {
    createItinerarySchema,
    updateItinerarySchema,
    itineraryIdSchema,
};