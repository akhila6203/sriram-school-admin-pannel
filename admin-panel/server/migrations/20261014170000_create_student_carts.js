exports.up = async function (knex) {
  const hasCarts = await knex.schema.hasTable("carts");

  if (!hasCarts) {
    await knex.schema.createTable("carts", (table) => {
      table.increments("id").primary();

      table
        .integer("student_id")
        .unsigned()
        .notNullable()
        .unique();

      table.timestamps(true, true);
    });
  }

  const hasCartItems = await knex.schema.hasTable("cart_items");

  if (!hasCartItems) {
    await knex.schema.createTable("cart_items", (table) => {
      table.increments("id").primary();

      table
        .integer("cart_id")
        .unsigned()
        .notNullable();

      table
        .integer("product_id")
        .unsigned()
        .notNullable();

      table
        .integer("variant_id")
        .unsigned()
        .nullable();

      table
        .integer("kit_id")
        .unsigned()
        .nullable();

      table
        .boolean("is_kit_item")
        .notNullable()
        .defaultTo(false);

      table
        .integer("quantity")
        .unsigned()
        .notNullable()
        .defaultTo(1);

      table.timestamps(true, true);

      table
        .foreign("cart_id")
        .references("id")
        .inTable("carts")
        .onDelete("CASCADE");

      table.index("product_id");
      table.index("variant_id");
      table.index("kit_id");
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("cart_items");
  await knex.schema.dropTableIfExists("carts");
};