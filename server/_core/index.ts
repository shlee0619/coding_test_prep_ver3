import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV, validateRequiredEnvVars } from "./env";
import { isDatabaseConfigured, isDatabaseReachable } from "../db";
import { hasRedis } from "./redis";

const LOCAL_ORIGINS: string[] = ["http://localhost:8081", "http://localhost:3000", "http://localhost:19006"];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  // 개발 환경에서는 localhost 허용
  if (!ENV.isProduction && LOCAL_ORIGINS.includes(origin)) {
    return true;
  }

  // 개발 환경에서만 Vercel preview 도메인을 허용
  if (!ENV.isProduction && origin.endsWith(".vercel.app")) {
    return true;
  }

  return ENV.allowedOrigins.includes(origin);
}

/**
 * Express 앱 생성 (serverless / standalone 모두에서 재사용)
 */
export function createApp() {
  validateRequiredEnvVars();

  const app = express();

  // Enable CORS with whitelist-based origin validation
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
    } else if (origin) {
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );

    if (req.method === "OPTIONS") {
      if (isAllowedOrigin(origin)) {
        res.sendStatus(200);
      } else {
        res.sendStatus(403);
      }
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", async (_req, res) => {
    const [databaseReachable] = await Promise.all([isDatabaseReachable()]);
    const databaseConfigured = isDatabaseConfigured();
    const redisEnabled = hasRedis();

    const degraded = ENV.isProduction && (!databaseConfigured || !databaseReachable);

    res.status(degraded ? 503 : 200).json({
      ok: !degraded,
      timestamp: Date.now(),
      dependencies: {
        database: {
          configured: databaseConfigured,
          reachable: databaseReachable,
        },
        redis: {
          enabled: redisEnabled,
        },
      },
    });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}

// ==================== Standalone Server ====================

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  try {
    const app = createApp();
    const server = createServer(app);

    const preferredPort = parseInt(process.env.PORT || "3000");
    const port = await findAvailablePort(preferredPort);

    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }

    server.listen(port, () => {
      console.log(`[api] server listening on port ${port}`);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Vercel serverless 환경에서는 standalone 서버를 시작하지 않음
if (!process.env.VERCEL) {
  startServer().catch(console.error);
}
