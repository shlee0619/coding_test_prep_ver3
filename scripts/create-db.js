import "dotenv/config";
import mysql from "mysql2/promise";

function getDbConnectionParams() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const parsed = new URL(databaseUrl);
  if (!parsed.protocol.startsWith("mysql")) {
    throw new Error("DATABASE_URL must use mysql protocol");
  }

  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    databaseName,
  };
}

async function createDb() {
  const { host, port, user, password, databaseName } = getDbConnectionParams();

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  try {
    const escapedDatabaseName = databaseName.replace(/`/g, "``");
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${escapedDatabaseName}\``);
    console.log(`Database "${databaseName}" created or already exists.`);
  } catch (error) {
    console.error("Error creating database:", error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

createDb().catch((error) => {
  console.error("Failed to create database:", error);
  process.exit(1);
});
