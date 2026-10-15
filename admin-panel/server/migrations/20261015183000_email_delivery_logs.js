exports.up = async function (knex) {
  await knex.schema.createTable('order_email_deliveries', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('order_id').unsigned().notNullable();
    t.string('email_type', 40).notNullable().defaultTo('order_confirmation');
    t.string('recipient_email', 190).notNullable().defaultTo('');
    t.string('status', 20).notNullable().defaultTo('pending');
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('claimed_at').nullable();
    t.timestamp('sent_at').nullable();
    t.text('last_error').nullable();
    t.timestamps(true, true);
    t.unique(['order_id', 'email_type']);
    t.index(['status', 'claimed_at']);
  });
  await knex.schema.createTable('daily_report_deliveries', (t) => {
    t.bigIncrements('id').primary();
    t.date('report_date').notNullable();
    t.string('recipient_email', 190).notNullable();
    t.string('report_type', 40).notNullable().defaultTo('daily_orders');
    t.string('status', 20).notNullable().defaultTo('pending');
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('claimed_at').nullable();
    t.timestamp('sent_at').nullable();
    t.text('last_error').nullable();
    t.timestamps(true, true);
    t.unique(['report_date', 'recipient_email', 'report_type'], 'unique_daily_report');
  });
};
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('daily_report_deliveries');
  await knex.schema.dropTableIfExists('order_email_deliveries');
};
