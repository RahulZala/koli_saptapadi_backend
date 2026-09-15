const { Pool } = require("pg");
const env = require("./env");

let poolConfig;

const connectionString = env.SUPABASE_DATABASE_URL || env.DATABASE_URL;

if (connectionString && connectionString.startsWith("postgres")) {
  poolConfig = {
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  const isSupabaseHost = (env.DB_HOST || "").includes("supabase") || (env.SUPABASE_DB_HOST || "").includes("supabase");
  poolConfig = {
    host: env.SUPABASE_DB_HOST || env.DB_HOST,
    port: env.SUPABASE_DB_PORT || env.DB_PORT || 5432,
    user: env.SUPABASE_DB_USER || env.DB_USER || "postgres",
    password: env.SUPABASE_DB_PASSWORD || env.DB_PASSWORD,
    database: env.SUPABASE_DB_NAME || env.DB_NAME || "postgres",
    max: env.DB_CONNECTION_LIMIT || 10,
    ssl: isSupabaseHost || env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  };
}

const pool = new Pool(poolConfig);

// Helper function to query with array destructuring support matching promise execute: [rows, result]
pool.execute = async (text, params = []) => {
  const result = await pool.query(text, params);
  return [result.rows, result];
};

module.exports = pool;
