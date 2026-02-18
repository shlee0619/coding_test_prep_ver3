#!/usr/bin/env node

import { randomBytes } from "node:crypto";

const sizeArg = process.argv[2] ?? "64";
const size = Number.parseInt(sizeArg, 10);

if (!Number.isInteger(size) || size < 32 || size > 256) {
  console.error("Usage: node scripts/generate-jwt-secret.mjs [byte-length]");
  console.error("byte-length must be an integer between 32 and 256 (default: 64).");
  process.exit(1);
}

const secret = randomBytes(size).toString("base64url");
console.log(secret);
