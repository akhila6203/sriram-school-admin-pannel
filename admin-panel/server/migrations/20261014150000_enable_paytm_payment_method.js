exports.up = async function (knex) {
  const hasTable = await knex.schema.hasTable("settings");

  if (!hasTable) {
    throw new Error("settings table does not exist");
  }

  const row = await knex("settings")
    .where("setting_key", "payment_methods")
    .first();

  let methods = [];

  if (row?.setting_value) {
    methods =
      typeof row.setting_value === "string"
        ? JSON.parse(row.setting_value)
        : row.setting_value;
  }

  if (!Array.isArray(methods)) {
    methods = [];
  }

  const existingPaytm = methods.find(
    (method) => method.id === "paytm"
  );

  if (existingPaytm) {
    methods = methods.map((method) =>
      method.id === "paytm"
        ? { ...method, enabled: true }
        : method
    );
  } else {
    methods.unshift({
      id: "paytm",
      label: "Paytm",
      enabled: true,
    });
  }

  const value = JSON.stringify(methods);

  if (row) {
    await knex("settings")
      .where("setting_key", "payment_methods")
      .update({
        setting_value: value,
      });
  } else {
    await knex("settings").insert({
      setting_key: "payment_methods",
      setting_value: value,
    });
  }

  // Enable main Paytm setting too.
  const mainSetting = await knex("settings")
    .where("setting_key", "paytm_enabled")
    .first();

  if (mainSetting) {
    await knex("settings")
      .where("setting_key", "paytm_enabled")
      .update({
        setting_value: JSON.stringify(true),
      });
  } else {
    await knex("settings").insert({
      setting_key: "paytm_enabled",
      setting_value: JSON.stringify(true),
    });
  }
};

exports.down = async function () {
  // Intentionally no-op:
  // Do not disable a live payment method on rollback.
};