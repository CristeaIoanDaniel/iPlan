const { z } = require('zod');

const itineraryId = z.string().uuid('Itinerary ID must be a valid UUID');
const collaboratorId = z.string().uuid('Collaborator ID must be a valid UUID');
const role = z.enum(['viewer', 'editor']);

const itineraryParams = z.object({ id: itineraryId }).strict();

const addCollaboratorSchema = z.object({
  params: itineraryParams,
  body: z.object({
    email: z.string().trim().email('Invalid email address format')
      .transform((value) => value.toLowerCase()),
    role: role.default('viewer'),
  }).strict(),
});

const updateCollaboratorSchema = z.object({
  params: z.object({
    id: itineraryId,
    userId: collaboratorId,
  }).strict(),
  body: z.object({ role }).strict(),
});

const itineraryCollaboratorsSchema = z.object({
  params: itineraryParams,
});

const removeCollaboratorSchema = z.object({
  params: z.object({
    id: itineraryId,
    userId: collaboratorId,
  }).strict(),
});

module.exports = {
  addCollaboratorSchema,
  updateCollaboratorSchema,
  itineraryCollaboratorsSchema,
  removeCollaboratorSchema,
};
