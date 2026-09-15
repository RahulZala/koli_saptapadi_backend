const { Pool } = require("pg");
const env = require("./env");

let poolConfig;

if (env.DATABASE_URL && env.DATABASE_URL.startsWith("postgres")) {
  poolConfig = {
    connectionString: env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  poolConfig = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: env.DB_CONNECTION_LIMIT,
    ssl: env.DB_HOST.includes("supabase") ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(poolConfig);

// Helper function to query with helper format matching promise execute
pool.execute = async (text, params = []) => {
  const result = await pool.query(text, params);
  return [result.rows, result];
};

module.exports = pool;
