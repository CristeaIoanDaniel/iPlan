/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function createIndexIfColumnsExist(knex, tableName, columns, indexName) {
    if (!(await knex.schema.hasTable(tableName))) {
        return;
    }
    for (const column of columns) {
        if (!(await knex.schema.hasColumn(tableName, column))) {
            return;
        }
    }
    await knex.schema.alterTable(tableName, (table) => {
        table.index(columns, indexName);
    });
}

exports.up = async function(knex) {
    await createIndexIfColumnsExist(knex, 'itineraries', ['user_id'], 'idx_itineraries_user_id');
    await createIndexIfColumnsExist(knex, 'bookings', ['itinerary_id'], 'idx_bookings_itinerary_id');
    await createIndexIfColumnsExist(knex, 'bookings', ['user_id'], 'idx_bookings_user_id');
    await createIndexIfColumnsExist(
        knex,
        'bookings',
        ['service_id', 'status'],
        'idx_bookings_service_id_status'
    );
    await createIndexIfColumnsExist(
        knex,
        'services',
        ['type', 'is_active'],
        'idx_services_type_is_active'
    );
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
    await knex.raw('DROP INDEX IF EXISTS "idx_itineraries_user_id"');
    await knex.raw('DROP INDEX IF EXISTS "idx_bookings_itinerary_id"');
    await knex.raw('DROP INDEX IF EXISTS "idx_bookings_user_id"');
    await knex.raw('DROP INDEX IF EXISTS "idx_bookings_service_id_status"');
    await knex.raw('DROP INDEX IF EXISTS "idx_services_type_is_active"');
};
