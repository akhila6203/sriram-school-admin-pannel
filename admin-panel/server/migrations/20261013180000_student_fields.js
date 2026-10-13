
exports.up = async function (knex) {
  // Add student details only when columns do not exist.
  const columns = [
    ['class_name', (table) => table.string('class_name', 50).nullable()],
    ['age', (table) => table.integer('age').nullable()],
    ['gender', (table) => table.string('gender', 30).nullable()],
    ['email', (table) => table.string('email', 255).nullable()],
  ];

  for (const [columnName, addColumn] of columns) {
    const exists = await knex.schema.hasColumn('students', columnName);

    if (!exists) {
      await knex.schema.alterTable('students', (table) => {
        addColumn(table);
      });
    }
  }

  // Class filtering index
  const indexRows = await knex.raw(
    "SHOW INDEX FROM `students` WHERE Key_name = 'students_class_name_index'"
  );

  const indexes = Array.isArray(indexRows[0])
    ? indexRows[0]
    : indexRows;

  if (!indexes.length) {
    await knex.schema.alterTable('students', (table) => {
      table.index('class_name', 'students_class_name_index');
    });
  }

  // Save additional columns imported from Excel
  const extrasTableExists = await knex.schema.hasTable(
    'student_extra_fields'
  );

  if (!extrasTableExists) {
    await knex.schema.createTable('student_extra_fields', (table) => {
      table.bigIncrements('id').primary();

      // This must match the students.id column type.
      table
        .bigInteger('student_id')
        .unsigned()
        .notNullable();

      table.string('field_name', 191).notNullable();
      table.text('field_value').nullable();

      table.unique(
        ['student_id', 'field_name'],
        'student_extra_fields_student_field_unique'
      );

      table.index(
        'student_id',
        'student_extra_fields_student_id_index'
      );
    });

    // Add foreign key only if students.id is BIGINT UNSIGNED.
    // If students.id is INT UNSIGNED, change the student_id
    // column above to table.integer('student_id').unsigned().
    await knex.schema.alterTable('student_extra_fields', (table) => {
      table
        .foreign('student_id', 'student_extra_fields_student_fk')
        .references('id')
        .inTable('students')
        .onDelete('CASCADE');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('student_extra_fields');

  const hasClass = await knex.schema.hasColumn(
    'students',
    'class_name'
  );

  if (hasClass) {
    await knex.schema.alterTable('students', (table) => {
      table.dropIndex('class_name', 'students_class_name_index');
    });
  }

  const columns = [
    'class_name',
    'age',
    'gender',
    'email',
  ];

  for (const columnName of columns) {
    const exists = await knex.schema.hasColumn(
      'students',
      columnName
    );

    if (exists) {
      await knex.schema.alterTable('students', (table) => {
        table.dropColumn(columnName);
      });
    }
  }
};
