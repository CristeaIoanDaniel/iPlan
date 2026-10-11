/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('itinerary_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('itinerary_id').notNullable()
      .references('id').inTable('itineraries').onDelete('CASCADE');
    table.string('item_type', 20).notNullable();
    table.string('title', 255).notNullable();
    table.text('description');
    table.timestamp('starts_at', { useTz: true });
    table.timestamp('ends_at', { useTz: true });
    table.timestamps(true, true);
    table.check(
      "item_type IN ('flight', 'hotel', 'activity', 'note')",
      [],
      'itinerary_items_type_check',
    );
    table.check(
      "(item_type = 'note' AND starts_at IS NULL AND ends_at IS NULL) OR "
        + "(item_type IN ('flight', 'hotel', 'activity') AND starts_at IS NOT NULL "
        + 'AND ends_at IS NOT NULL AND ends_at > starts_at)',
      [],
      'itinerary_items_date_range_check',
    );
    table.index(['itinerary_id', 'starts_at'], 'idx_itinerary_items_itinerary_start');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('itinerary_items');
};
