const pool = require("../config/database");

class BlockRepository {
  constructor() {
    this.schemaReady = null;
  }

  async ensureTable() {
    if (!this.schemaReady) {
      this.schemaReady = pool.query(`
        CREATE TABLE IF NOT EXISTS user_blocks (
          blocker_id INT NOT NULL,
          blocked_id INT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (blocker_id, blocked_id),
          CHECK (blocker_id <> blocked_id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks(blocked_id);
      `).catch((err) => {
        this.schemaReady = null;
        throw err;
      });
    }
    await this.schemaReady;
  }

  async getBlockStatus(userId, partnerId) {
    await this.ensureTable();
    const [rows] = await pool.execute(
      `SELECT blocker_id, blocked_id
       FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [userId, partnerId]
    );
    return {
      blockedByMe: rows.some((row) => parseInt(row.blocker_id, 10) === parseInt(userId, 10)),
      blockingMe: rows.some((row) => parseInt(row.blocker_id, 10) === parseInt(partnerId, 10))
    };
  }

  async isBlockedBetween(userId, partnerId) {
    const status = await this.getBlockStatus(userId, partnerId);
    return status.blockedByMe || status.blockingMe;
  }

  async setBlock(userId, partnerId, blocked) {
    await this.ensureTable();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock($1::integer, $2::integer)",
        [Math.min(userId, partnerId), Math.max(userId, partnerId)]
      );
      const result = blocked
        ? await client.query(
          `INSERT INTO user_blocks (blocker_id, blocked_id)
           VALUES ($1, $2)
           ON CONFLICT (blocker_id, blocked_id) DO NOTHING
           RETURNING blocker_id`,
          [userId, partnerId]
        )
        : await client.query(
          `DELETE FROM user_blocks
           WHERE blocker_id = $1 AND blocked_id = $2
           RETURNING blocker_id`,
          [userId, partnerId]
        );
      await client.query("COMMIT");
      return blocked || Boolean(result.rows && result.rows.length > 0);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new BlockRepository();
