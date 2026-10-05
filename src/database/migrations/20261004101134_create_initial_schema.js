/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
    const existingTables = [];
    await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await knex.schema.createTable('itineraries',(table)=>{
        table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
        table.uuid('user_id').notNullable();
        table.string('title',255).notNullable();
        table.text('description');
        table.date('start_date').notNullable();
        table.date('end_date').notNullable();
        table.boolean('is_public').defaultTo(false);
        table.timestamps(true,true);
    });
    await knex.schema.createTable('services', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('host_id').notNullable();
    table.string('title', 255).notNullable();
    table.enum('type', ['ACCOMMODATION', 'ACTIVITY', 'TRANSPORT']).notNullable();
    table.decimal('price_per_unit', 10, 2).notNullable();
    table.integer('max_capacity').notNullable().defaultTo(1);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
  await knex.schema.createTable('bookings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.uuid('user_id').notNullable();
    table.uuid('itinerary_id').references('id').inTable('itineraries').onDelete('CASCADE');
    table.uuid('service_id').references('id').inTable('services').onDelete('RESTRICT');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').notNullable();
    table.decimal('total_price', 10, 2).notNullable();
    table.enum('status', ['PENDING', 'CONFIRMED', 'CANCELLED']).defaultTo('PENDING');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('bookings');
    await knex.schema.dropTableIfExists('services');
    return await knex.schema.dropTableIfExists('itineraries');
};