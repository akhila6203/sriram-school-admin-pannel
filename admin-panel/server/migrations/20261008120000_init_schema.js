/**
 * Scholar Store — initial MySQL schema (admin owns migrations)
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

  await knex.schema.createTable('admin_users', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 120).notNullable();
    t.string('email', 190).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.enum('role', ['super_admin', 'staff']).notNullable().defaultTo('staff');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('students', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('admission_number', 50).notNullable();
    t.string('student_name', 150).notNullable();
    t.string('parent_name', 150).notNullable();
    t.string('address1', 255).notNullable();
    t.string('address2', 255).notNullable().defaultTo('');
    t.string('city', 100).notNullable();
    t.string('state', 100).notNullable();
    t.string('zipcode', 10).notNullable();
    t.string('house_color', 30).notNullable();
    t.string('phone', 20).nullable();
    t.enum('kit_status', ['pending', 'ordered']).notNullable().defaultTo('pending');
    t.enum('catalog_override', ['default', 'force_kit', 'force_individual'])
      .notNullable()
      .defaultTo('default');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('first_login_at').nullable();
    t.timestamp('last_login_at').nullable();
    t.timestamps(true, true);

    t.unique(['admission_number']);
    t.index(['admission_number']);
    t.index(['house_color']);
    t.index(['kit_status']);
    t.index(['is_active']);
  });

  await knex.schema.createTable('categories', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 120).notNullable();
    t.string('slug', 150).notNullable().unique();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('products', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 200).notNullable();
    t.string('slug', 220).notNullable().unique();
    t.text('description').nullable();
    t.bigInteger('category_id').unsigned().notNullable();
    t.string('brand', 120).nullable().defaultTo('');
    t.decimal('base_price', 10, 2).notNullable();
    t.decimal('compare_at_price', 10, 2).nullable();
    t.decimal('tax_percent', 5, 2).notNullable().defaultTo(0);
    t.enum('status', ['draft', 'active', 'archived']).notNullable().defaultTo('draft');
    t.boolean('visible_individually').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.foreign('category_id').references('id').inTable('categories').onDelete('RESTRICT');
    t.index(['category_id']);
    t.index(['status']);
  });

  await knex.schema.createTable('product_images', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('product_id').unsigned().notNullable();
    t.string('url', 500).notNullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.timestamps(true, true);

    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
    t.index(['product_id']);
  });

  await knex.schema.createTable('product_variants', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('product_id').unsigned().notNullable();
    t.string('sku', 100).notNullable();
    t.string('option1_name', 50).nullable();
    t.string('option1_value', 80).nullable();
    t.string('option2_name', 50).nullable();
    t.string('option2_value', 80).nullable();
    t.decimal('price_override', 10, 2).nullable();
    t.integer('stock_qty').unsigned().notNullable().defaultTo(0);
    t.integer('low_stock_threshold').notNullable().defaultTo(5);
    t.string('barcode', 100).nullable();
    t.integer('weight_grams').nullable();
    t.string('image_url', 500).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.unique(['sku']);
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE');
    t.index(['sku']);
    t.index(['product_id']);
    t.index(['stock_qty']);
  });

  await knex.schema.createTable('kits', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('name', 150).notNullable();
    t.text('description').nullable();
    t.string('image_url', 500).nullable();
    t.decimal('price', 10, 2).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('kit_items', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('kit_id').unsigned().notNullable();
    t.bigInteger('product_id').unsigned().notNullable();
    t.integer('quantity').unsigned().notNullable().defaultTo(1);
    t.boolean('student_picks_size').notNullable().defaultTo(true);
    t.boolean('auto_match_house_color').notNullable().defaultTo(false);
    t.timestamps(true, true);

    t.foreign('kit_id').references('id').inTable('kits').onDelete('CASCADE');
    t.foreign('product_id').references('id').inTable('products').onDelete('RESTRICT');
    t.unique(['kit_id', 'product_id']);
    t.index(['kit_id']);
    t.index(['product_id']);
  });

  await knex.schema.createTable('orders', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('order_number', 30).notNullable();
    t.bigInteger('student_id').unsigned().notNullable();
    t.enum('type', ['kit', 'individual']).notNullable();
    t.enum('status', [
      'placed',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
    ])
      .notNullable()
      .defaultTo('placed');
    t.enum('payment_status', ['pending', 'paid', 'failed', 'refunded'])
      .notNullable()
      .defaultTo('pending');
    t.string('payment_method', 50).notNullable().defaultTo('cod');
    t.decimal('subtotal', 10, 2).notNullable();
    t.decimal('tax', 10, 2).notNullable().defaultTo(0);
    t.decimal('shipping', 10, 2).notNullable().defaultTo(0);
    t.decimal('total', 10, 2).notNullable();
    t.json('address_snapshot').notNullable();
    t.text('notes').nullable();
    t.timestamps(true, true);

    t.unique(['order_number']);
    t.foreign('student_id').references('id').inTable('students').onDelete('RESTRICT');
    t.index(['order_number']);
    t.index(['status']);
    t.index(['created_at']);
    t.index(['student_id']);
    t.index(['type']);
    t.index(['payment_status']);
  });

  await knex.schema.createTable('order_items', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('order_id').unsigned().notNullable();
    t.bigInteger('product_id').unsigned().notNullable();
    t.bigInteger('variant_id').unsigned().notNullable();
    t.string('name_snapshot', 200).notNullable();
    t.string('sku_snapshot', 100).notNullable();
    t.string('option_snapshot', 100).nullable();
    t.decimal('unit_price', 10, 2).notNullable();
    t.integer('quantity').unsigned().notNullable();
    t.decimal('line_total', 10, 2).notNullable();
    t.timestamps(true, true);

    t.foreign('order_id').references('id').inTable('orders').onDelete('CASCADE');
    t.foreign('product_id').references('id').inTable('products').onDelete('RESTRICT');
    t.foreign('variant_id').references('id').inTable('product_variants').onDelete('RESTRICT');
    t.index(['order_id']);
  });

  await knex.schema.createTable('order_status_history', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('order_id').unsigned().notNullable();
    t.enum('status', [
      'placed',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
    ]).notNullable();
    t.string('changed_by', 120).nullable();
    t.text('note').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.foreign('order_id').references('id').inTable('orders').onDelete('CASCADE');
    t.index(['order_id']);
  });

  await knex.schema.createTable('stock_movements', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.bigInteger('variant_id').unsigned().notNullable();
    t.integer('change_qty').notNullable();
    t.enum('reason', [
      'initial',
      'restock',
      'adjustment',
      'order',
      'cancel',
      'return',
    ]).notNullable();
    t.bigInteger('order_id').unsigned().nullable();
    t.bigInteger('admin_user_id').unsigned().nullable();
    t.text('note').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.foreign('variant_id').references('id').inTable('product_variants').onDelete('CASCADE');
    t.foreign('order_id').references('id').inTable('orders').onDelete('SET NULL');
    t.foreign('admin_user_id').references('id').inTable('admin_users').onDelete('SET NULL');
    t.index(['variant_id']);
    t.index(['order_id']);
    t.index(['created_at']);
  });

  await knex.schema.createTable('settings', (t) => {
    t.string('setting_key', 100).primary();
    t.json('setting_value').notNullable();
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('import_logs', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('file_name', 255).notNullable();
    t.integer('total_rows').notNullable().defaultTo(0);
    t.integer('created_count').notNullable().defaultTo(0);
    t.integer('updated_count').notNullable().defaultTo(0);
    t.integer('failed_count').notNullable().defaultTo(0);
    t.json('error_report').nullable();
    t.bigInteger('admin_user_id').unsigned().nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.foreign('admin_user_id').references('id').inTable('admin_users').onDelete('SET NULL');
    t.index(['created_at']);
  });

  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
  await knex.schema.dropTableIfExists('import_logs');
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('stock_movements');
  await knex.schema.dropTableIfExists('order_status_history');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('kit_items');
  await knex.schema.dropTableIfExists('kits');
  await knex.schema.dropTableIfExists('product_variants');
  await knex.schema.dropTableIfExists('product_images');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('students');
  await knex.schema.dropTableIfExists('admin_users');
  await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
};





// CREATE TABLE IF NOT EXISTS admin_user_permissions (
//     id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

//     admin_user_id BIGINT UNSIGNED NOT NULL,

//     permission_key VARCHAR(60) NOT NULL,

//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

//     UNIQUE KEY unique_user_permission (
//         admin_user_id,
//         permission_key
//     ),

//     CONSTRAINT fk_admin_user_permissions
//         FOREIGN KEY (admin_user_id)
//         REFERENCES admin_users(id)
//         ON DELETE CASCADE
// );