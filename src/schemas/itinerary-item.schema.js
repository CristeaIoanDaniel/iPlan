const { z } = require('zod');

const title = z.string().trim().min(1).max(255);
const description = z.string().trim().max(5000).optional();
const dateTime = z.string().datetime({
  offset: true,
  message: 'Date-time must be ISO 8601 and include a timezone',
});
const params = z.object({
  id: z.string().uuid('Itinerary ID must be a valid UUID'),
  itemId: z.string().uuid('Item ID must be a valid UUID').optional(),
}).strict();

const datedItem = z.object({
  type: z.enum(['flight', 'hotel', 'activity']),
  title,
  description,
  starts_at: dateTime,
  ends_at: dateTime,
}).strict().refine(
  (item) => Date.parse(item.ends_at) > Date.parse(item.starts_at),
  {
    message: 'End time must be after start time',
    path: ['ends_at'],
  },
);

const noteItem = z.object({
  type: z.literal('note'),
  title,
  description,
}).strict();

const createItemSchema = z.object({
  params: z.object({ id: params.shape.id }).strict(),
  body: z.discriminatedUnion('type', [
    datedItem,
    noteItem,
  ]),
});

const updateItemSchema = z.object({
  params,
  body: z.object({
    title: title.optional(),
    description: description,
    starts_at: dateTime.optional(),
    ends_at: dateTime.optional(),
  }).strict().refine((item) => Object.keys(item).length > 0, {
    message: 'At least one item field must be provided',
  }).refine(
    (item) => !item.starts_at || !item.ends_at
      || Date.parse(item.ends_at) > Date.parse(item.starts_at),
    {
      message: 'End time must be after start time',
      path: ['ends_at'],
    },
  ),
});

const itineraryItemsSchema = z.object({
  params: z.object({ id: params.shape.id }).strict(),
});

const itemParamsSchema = z.object({ params });

module.exports = {
  createItemSchema,
  updateItemSchema,
  itineraryItemsSchema,
  itemParamsSchema,
};
