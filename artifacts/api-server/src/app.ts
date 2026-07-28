import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorMonitorMiddleware } from "./middleware/errorMonitor";

const app: Express = express();

// Trust Cloud Run / Replit's reverse proxy so express-rate-limit and
// req.ip use the real client IP from X-Forwarded-For, not the proxy IP.
// Without this, express-rate-limit v8 throws a ValidationError on every
// request that has X-Forwarded-For set, resulting in a 500 response.
app.set("trust proxy", 1);

// Redirect replit.app URL to custom domain
app.use((req, res, next) => {
  const host = req.headers.host ?? "";
  if (host.includes("replit.app")) {
    return res.redirect(301, `https://shepherdconnect.intelyticslimited.com${req.originalUrl}`);
  }
  next();
});

// Global rate limiter — 300 requests per minute per IP.
// Tighter limits on specific sensitive routes (OTP, auth) are applied there.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => req.method === "OPTIONS",
});
app.use(globalLimiter);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// JSON 404 for any unmatched /api/* path (must come before the error handler)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorMonitorMiddleware as any);

export default app;
