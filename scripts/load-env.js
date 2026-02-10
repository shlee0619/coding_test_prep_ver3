/**
 * Load .env with lower priority than process-level environment variables.
 * This keeps CI/shell-injected values intact while still supporting local defaults.
 */
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");

  lines.forEach((line) => {
    if (!line || line.trim().startsWith("#")) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) return;

    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}
