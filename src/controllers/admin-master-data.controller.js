const pool = require("../config/database");

const TYPES = {
  states: { table: "states" },
  districts: { table: "districts", parentColumn: "state_id", parentTable: "states" },
  cities: { table: "cities", parentColumn: "district_id", parentTable: "districts" },
  sub_castes: { table: "sub_castes", active: true }
};

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseActive(value) {
  if (value === true || value === 1 || value === "1" || value === "true") return true;
  if (value === false || value === 0 || value === "0" || value === "false") return false;
  return null;
}

function toActiveFlag(value) {
  return ["1", "true", "t"].includes(String(value).toLowerCase());
}

function getType(type) {
  return Object.prototype.hasOwnProperty.call(TYPES, type) ? TYPES[type] : null;
}

class AdminMasterDataController {
  async getMasterData(req, res) {
    try {
      const [[states], [districts], [cities], [subCastes]] = await Promise.all([
        pool.execute("SELECT id, name FROM states ORDER BY name ASC"),
        pool.execute(`
          SELECT d.id, d.name, d.state_id, s.name AS state_name
          FROM districts d
          JOIN states s ON s.id = d.state_id
          ORDER BY s.name ASC, d.name ASC
        `),
        pool.execute(`
          SELECT c.id, c.name, c.district_id, d.name AS district_name,
                 d.state_id, s.name AS state_name
          FROM cities c
          JOIN districts d ON d.id = c.district_id
          JOIN states s ON s.id = d.state_id
          ORDER BY s.name ASC, d.name ASC, c.name ASC
        `),
        pool.execute(`
          SELECT id, name,
                 (is_active::text IN ('1', 'true', 't')) AS is_active
          FROM sub_castes
          ORDER BY name ASC
        `)
      ]);

      return res.json({ states, districts, cities, sub_castes: subCastes });
    } catch (err) {
      console.error("Admin getMasterData error:", err);
      return res.status(500).json({ error: "Failed to fetch master data" });
    }
  }

  async createEntry(req, res) {
    const type = getType(req.params.type);
    if (!type) return res.status(404).json({ error: "Unknown master data type" });

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name || name.length > 100) {
      return res.status(400).json({ error: "Name is required and must be 100 characters or fewer" });
    }

    try {
      let parentId = null;
      if (type.parentColumn) {
        parentId = parseId(req.body[type.parentColumn]);
        if (!parentId) {
          return res.status(400).json({ error: `${type.parentColumn} is required` });
        }

        const [parents] = await pool.execute(
          `SELECT id FROM ${type.parentTable} WHERE id = $1`,
          [parentId]
        );
        if (!parents.length) {
          return res.status(400).json({ error: "Selected parent location was not found" });
        }
      }

      if (await this.nameExists(type, name, parentId)) {
        return res.status(409).json({ error: "A record with this name already exists in the selected location" });
      }

      let rows;
      if (type.active) {
        const activeType = await this.getActiveColumnType();
        const activeValue = activeType === "boolean" ? true : 1;
        [rows] = await pool.execute(
          "INSERT INTO sub_castes (name, is_active) VALUES ($1, $2) RETURNING id, name, is_active",
          [name, activeValue]
        );
        rows[0].is_active = toActiveFlag(rows[0].is_active);
      } else if (type.parentColumn) {
        [rows] = await pool.execute(
          `INSERT INTO ${type.table} (name, ${type.parentColumn}) VALUES ($1, $2) RETURNING id, name, ${type.parentColumn}`,
          [name, parentId]
        );
      } else {
        const [countryColumns] = await pool.execute(`
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'states'
            AND column_name = 'country'
        `);
        [rows] = countryColumns.length
          ? await pool.execute(
            "INSERT INTO states (name, country) VALUES ($1, 'India') RETURNING id, name",
            [name]
          )
          : await pool.execute(
            "INSERT INTO states (name) VALUES ($1) RETURNING id, name",
            [name]
          );
      }

      return res.status(201).json(rows[0]);
    } catch (err) {
      console.error("Admin createMasterData error:", err);
      return res.status(500).json({ error: "Failed to add master data" });
    }
  }

  async updateEntry(req, res) {
    const type = getType(req.params.type);
    const id = parseId(req.params.id);
    if (!type) return res.status(404).json({ error: "Unknown master data type" });
    if (!id) return res.status(400).json({ error: "A valid record ID is required" });

    try {
      const activeColumn = type.active ? ", is_active" : "";
      const parentColumn = type.parentColumn ? `, ${type.parentColumn}` : "";
      const [existingRows] = await pool.execute(
        `SELECT id, name${parentColumn}${activeColumn} FROM ${type.table} WHERE id = $1`,
        [id]
      );
      if (!existingRows.length) return res.status(404).json({ error: "Master data record not found" });
      const existing = existingRows[0];
      const body = req.body || {};
      const hasName = Object.prototype.hasOwnProperty.call(body, "name");
      const name = hasName
        ? (typeof body.name === "string" ? body.name.trim() : "")
        : existing.name;

      if (!name || name.length > 100) {
        return res.status(400).json({ error: "Name is required and must be 100 characters or fewer" });
      }

      let parentId = null;
      if (type.parentColumn) {
        parentId = Object.prototype.hasOwnProperty.call(body, type.parentColumn)
          ? parseId(body[type.parentColumn])
          : existing[type.parentColumn];
        if (!parentId) return res.status(400).json({ error: `${type.parentColumn} is required` });

        const [parents] = await pool.execute(
          `SELECT id FROM ${type.parentTable} WHERE id = $1`,
          [parentId]
        );
        if (!parents.length) {
          return res.status(400).json({ error: "Selected parent location was not found" });
        }

        if (parentId !== Number(existing[type.parentColumn])) {
          const dependencySql = req.params.type === "districts"
            ? `
              SELECT EXISTS (SELECT 1 FROM cities WHERE district_id = $1) AS has_children,
                     EXISTS (SELECT 1 FROM user_addresses WHERE district_id = $1) AS has_profiles
            `
            : `
              SELECT false AS has_children,
                     EXISTS (SELECT 1 FROM user_addresses WHERE city_id = $1) AS has_profiles
            `;
          const [dependencies] = await pool.execute(dependencySql, [id]);
          if (dependencies[0]?.has_children || dependencies[0]?.has_profiles) {
            return res.status(409).json({
              error: "This location cannot be moved while child locations or saved user addresses depend on it."
            });
          }
        }
      }

      if (await this.nameExists(type, name, parentId, id)) {
        return res.status(409).json({ error: "A record with this name already exists in the selected location" });
      }

      const values = [name];
      const assignments = ["name = $1"];
      if (type.parentColumn) {
        values.push(parentId);
        assignments.push(`${type.parentColumn} = $${values.length}`);
      }
      if (type.active && Object.prototype.hasOwnProperty.call(body, "is_active")) {
        const isActive = parseActive(body.is_active);
        if (isActive === null) {
          return res.status(400).json({ error: "is_active must be a boolean value" });
        }
        const activeType = await this.getActiveColumnType();
        values.push(activeType === "boolean" ? isActive : (isActive ? 1 : 0));
        assignments.push(`is_active = $${values.length}`);
      }
      values.push(id);

      const returning = type.active
        ? "id, name, is_active"
        : `id, name${type.parentColumn ? `, ${type.parentColumn}` : ""}`;
      const [rows] = await pool.execute(
        `UPDATE ${type.table} SET ${assignments.join(", ")} WHERE id = $${values.length} RETURNING ${returning}`,
        values
      );
      if (type.active) rows[0].is_active = toActiveFlag(rows[0].is_active);
      return res.json(rows[0]);
    } catch (err) {
      console.error("Admin updateMasterData error:", err);
      return res.status(500).json({ error: "Failed to update master data" });
    }
  }

  async removeEntry(req, res) {
    const type = getType(req.params.type);
    const id = parseId(req.params.id);
    if (!type) return res.status(404).json({ error: "Unknown master data type" });
    if (!id) return res.status(400).json({ error: "A valid record ID is required" });

    try {
      const [existingRows] = await pool.execute(
        `SELECT id FROM ${type.table} WHERE id = $1`,
        [id]
      );
      if (!existingRows.length) return res.status(404).json({ error: "Master data record not found" });

      if (type.active) {
        const activeType = await this.getActiveColumnType();
        const inactiveValue = activeType === "boolean" ? false : 0;
        await pool.execute(
          "UPDATE sub_castes SET is_active = $1 WHERE id = $2",
          [inactiveValue, id]
        );
        return res.json({ ok: true, message: "Sub-caste disabled. It can be re-enabled from admin." });
      }

      let dependencySql;
      if (req.params.type === "states") {
        dependencySql = `
          SELECT EXISTS (SELECT 1 FROM districts WHERE state_id = $1) AS has_children,
                 EXISTS (SELECT 1 FROM user_addresses WHERE state_id = $1) AS has_profiles
        `;
      } else if (req.params.type === "districts") {
        dependencySql = `
          SELECT EXISTS (SELECT 1 FROM cities WHERE district_id = $1) AS has_children,
                 EXISTS (SELECT 1 FROM user_addresses WHERE district_id = $1) AS has_profiles
        `;
      } else {
        dependencySql = `
          SELECT false AS has_children,
                 EXISTS (SELECT 1 FROM user_addresses WHERE city_id = $1) AS has_profiles
        `;
      }

      const [dependencies] = await pool.execute(dependencySql, [id]);
      if (dependencies[0]?.has_children || dependencies[0]?.has_profiles) {
        return res.status(409).json({
          error: "This location is in use by child locations or saved user addresses. Move those records first."
        });
      }

      await pool.execute(`DELETE FROM ${type.table} WHERE id = $1`, [id]);
      return res.json({ ok: true, message: "Location removed" });
    } catch (err) {
      console.error("Admin removeMasterData error:", err);
      return res.status(500).json({ error: "Failed to remove master data" });
    }
  }

  async nameExists(type, name, parentId, excludeId = null) {
    const values = [name];
    let where = "LOWER(name) = LOWER($1)";
    if (type.parentColumn) {
      values.push(parentId);
      where += ` AND ${type.parentColumn} = $${values.length}`;
    }
    if (excludeId !== null) {
      values.push(excludeId);
      where += ` AND id <> $${values.length}`;
    }
    const [rows] = await pool.execute(
      `SELECT id FROM ${type.table} WHERE ${where} LIMIT 1`,
      values
    );
    return rows.length > 0;
  }

  async getActiveColumnType() {
    const [rows] = await pool.execute(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sub_castes'
        AND column_name = 'is_active'
    `);
    if (!rows.length) throw new Error("sub_castes.is_active column was not found");
    return rows[0].data_type;
  }
}

module.exports = new AdminMasterDataController();
