
exports.up = async function (knex) {
  // =========================================
  // 1. PRODUCT ELIGIBILITY
  // =========================================

  const hasEligibilityTable =
    await knex.schema.hasTable("product_eligibility");

  if (!hasEligibilityTable) {
    await knex.schema.createTable(
      "product_eligibility",
      (table) => {
        table.bigIncrements("id").unsigned().primary();

        table
          .bigInteger("product_id")
          .unsigned()
          .notNullable()
          .references("id")
          .inTable("products")
          .onDelete("CASCADE");

        table
          .string("class_name", 50)
          .notNullable();

        table
          .enum("gender", [
            "boys",
            "girls",
            "both",
            "unisex",
          ])
          .notNullable()
          .defaultTo("both");

        table.unique([
          "product_id",
          "class_name",
        ]);

        table.index([
          "class_name",
          "gender",
        ]);
      }
    );
  }

  // =========================================
  // 2. KITS TABLE
  // =========================================

  const hasKitsTable =
    await knex.schema.hasTable("kits");

  if (!hasKitsTable) {
    throw new Error(
      "kits table does not exist. Run the original kits migration first."
    );
  }

  const hasClassName =
    await knex.schema.hasColumn(
      "kits",
      "class_name"
    );

  if (!hasClassName) {
    await knex.schema.alterTable(
      "kits",
      (table) => {
        table
          .string("class_name", 50)
          .nullable();
      }
    );
  }

  const hasGender =
    await knex.schema.hasColumn(
      "kits",
      "gender"
    );

  if (!hasGender) {
    await knex.schema.alterTable(
      "kits",
      (table) => {
        table
          .enum("gender", [
            "Boys",
            "Girls",
            "Both Boys and Girls",
            "Unisex",
          ])
          .notNullable()
          .defaultTo("Boys");
      }
    );
  }

  // Existing gender column unte its definition
  // automatically change avvadhu.
  // Verify its enum values before running.
};

exports.down = async function (knex) {
  // =========================================
  // ROLLBACK
  // =========================================

  // Kit columns existing project data ni
  // preserve cheyyadaniki drop cheyyatledhu.

  await knex.schema.dropTableIfExists(
    "product_eligibility"
  );
};
