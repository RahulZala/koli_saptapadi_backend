const assert = require("assert");
const pool = require("../src/config/database");
const controller = require("../src/controllers/admin-master-data.controller");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

async function run() {
  const originalExecute = pool.execute;
  try {
    let calls = [];
    pool.execute = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT id FROM districts")) return [[{ id: 9 }], null];
      if (sql.includes("LOWER(name)")) return [[], null];
      if (sql.includes("INSERT INTO cities")) {
        return [[{ id: 3, name: "Test City", district_id: 9 }], null];
      }
      throw new Error(`Unexpected query: ${sql}`);
    };

    const created = response();
    await controller.createEntry(
      { params: { type: "cities" }, body: { name: " Test City ", district_id: 9 } },
      created
    );
    assert.strictEqual(created.statusCode, 201);
    assert.deepStrictEqual(created.body, { id: 3, name: "Test City", district_id: 9 });
    assert(calls.some(({ sql }) => sql.includes("SELECT id FROM districts")));

    calls = [];
    pool.execute = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("LOWER(name)")) return [[], null];
      if (sql.includes("column_name = 'country'")) return [[{ column: 1 }], null];
      if (sql.includes("INSERT INTO states")) return [[{ id: 2, name: "Maharashtra" }], null];
      throw new Error(`Unexpected query: ${sql}`);
    };

    const createdState = response();
    await controller.createEntry(
      { params: { type: "states" }, body: { name: "Maharashtra" } },
      createdState
    );
    assert.strictEqual(createdState.statusCode, 201);
    assert(calls.some(({ sql }) => sql.includes("country) VALUES ($1, 'India')")));

    calls = [];
    pool.execute = async (sql) => {
      calls.push(sql);
      if (sql.includes("SELECT id, name, state_id FROM districts")) {
        return [[{ id: 4, name: "Old District", state_id: 1 }], null];
      }
      if (sql.includes("SELECT id FROM states")) return [[{ id: 2 }], null];
      if (sql.includes("LOWER(name)")) return [[], null];
      if (sql.includes("FROM cities WHERE district_id")) {
        return [[{ has_children: true, has_profiles: false }], null];
      }
      throw new Error(`Unexpected query: ${sql}`);
    };

    const blockedMove = response();
    await controller.updateEntry(
      { params: { type: "districts", id: "4" }, body: { state_id: 2 } },
      blockedMove
    );
    assert.strictEqual(blockedMove.statusCode, 409);
    assert(calls.every((sql) => !sql.startsWith("UPDATE districts")));

    calls = [];
    pool.execute = async (sql) => {
      calls.push(sql);
      if (sql.includes("SELECT id FROM states")) return [[{ id: 1 }], null];
      if (sql.includes("SELECT id FROM districts WHERE state_id")) return [[{ id: 4 }], null];
      if (sql.includes("user_addresses")) {
        return [[{ has_children: true, has_profiles: false }], null];
      }
      throw new Error(`Unexpected query: ${sql}`);
    };

    const blockedDelete = response();
    await controller.removeEntry({ params: { type: "states", id: "1" } }, blockedDelete);
    assert.strictEqual(blockedDelete.statusCode, 409);
    assert(calls.every((sql) => !sql.startsWith("DELETE FROM")));

    calls = [];
    pool.execute = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT id FROM sub_castes")) return [[{ id: 5 }], null];
      if (sql.includes("information_schema.columns")) return [[{ data_type: "smallint" }], null];
      if (sql.includes("UPDATE sub_castes")) return [[], null];
      throw new Error(`Unexpected query: ${sql}`);
    };

    const disabled = response();
    await controller.removeEntry({ params: { type: "sub_castes", id: "5" } }, disabled);
    assert.strictEqual(disabled.statusCode, 200);
    assert(calls.some(({ sql, params }) => sql.includes("UPDATE sub_castes") && params[0] === 0));

    const invalid = response();
    await controller.createEntry(
      { params: { type: "unknown" }, body: { name: "Anything" } },
      invalid
    );
    assert.strictEqual(invalid.statusCode, 404);

    const invalidInheritedType = response();
    await controller.createEntry(
      { params: { type: "constructor" }, body: { name: "Anything" } },
      invalidInheritedType
    );
    assert.strictEqual(invalidInheritedType.statusCode, 404);
  } finally {
    pool.execute = originalExecute;
  }

  console.log("Admin master-data validation, parent checks, safe deletion, and sub-caste deactivation verified.");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
