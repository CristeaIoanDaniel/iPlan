/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 50).notNullable();
    table.string('email', 255).notNullable().unique();
    table.text('password_hash').notNullable();
    table.string('role', 20).notNullable().defaultTo('user');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable('itineraries', (table) => {
    table.foreign('user_id', 'fk_itineraries_user_id')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.string('destination', 255);
  });

  await knex.schema.alterTable('bookings', (table) => {
    table.foreign('user_id', 'fk_bookings_user_id')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('bookings', (table) => {
    table.dropForeign('user_id', 'fk_bookings_user_id');
  });
  await knex.schema.alterTable('itineraries', (table) => {
    table.dropForeign('user_id', 'fk_itineraries_user_id');
    table.dropColumn('destination');
  });
  await knex.schema.dropTableIfExists('users');
};
