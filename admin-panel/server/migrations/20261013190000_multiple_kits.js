exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('kits', 'class_name'))) {
    await knex.schema.alterTable('kits', (table) => {
      table.string('class_name', 50).nullable()
    })
  }

  if (!(await knex.schema.hasColumn('kits', 'gender'))) {
    await knex.schema.alterTable('kits', (table) => {
      table.string('gender', 30).nullable()
    })
  }
}

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('kits', 'gender')) {
    await knex.schema.alterTable('kits', (table) => {
      table.dropColumn('gender')
    })
  }

  if (await knex.schema.hasColumn('kits', 'class_name')) {
    await knex.schema.alterTable('kits', (table) => {
      table.dropColumn('class_name')
    })
  }
}