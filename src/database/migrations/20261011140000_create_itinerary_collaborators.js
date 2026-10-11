/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('itinerary_collaborators', (table) => {
    table.uuid('itinerary_id').notNullable()
      .references('id').inTable('itineraries').onDelete('CASCADE');
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('role', 10).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['itinerary_id', 'user_id']);
    table.check("role IN ('viewer', 'editor')", [], 'itinerary_collaborators_role_check');
    table.index(['user_id', 'itinerary_id'], 'idx_itinerary_collaborators_user_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('itinerary_collaborators');
};
