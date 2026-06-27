/**
 * PM2 Cluster Configuration — Shepherd Connect API Server
 *
 * Runs one worker per CPU core so all cores handle traffic.
 * All workers share the same PostgreSQL DB, so bot sessions,
 * LID cache, and pending approvals remain consistent across workers.
 *
 * Usage (production server):
 *   npm install -g pm2
 *   pnpm --filter @workspace/api-server run build
 *   pm2 start artifacts/api-server/ecosystem.config.cjs
 *   pm2 save          # persist across reboots
 *   pm2 startup       # auto-start on boot
 *
 * Useful commands:
 *   pm2 status        — show all workers
 *   pm2 logs          — tail logs from all workers
 *   pm2 reload all    — zero-downtime reload (no dropped connections)
 *   pm2 stop all      — stop gracefully
 */
module.exports = {
  apps: [
    {
      name: "shepherd-api",
      script: "./dist/index.mjs",
      cwd: __dirname,

      // Cluster mode: one process per CPU core
      instances: "max",
      exec_mode: "cluster",

      // Environment
      env: {
        NODE_ENV: "production",
      },

      // Restart policy
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 2000,

      // Memory limit per worker — restart if exceeds 512 MB
      max_memory_restart: "512M",

      // Graceful shutdown — give WhatsApp socket time to close cleanly
      kill_timeout: 5000,
      wait_ready: false,

      // Log files
      out_file: "/tmp/shepherd-api-out.log",
      error_file: "/tmp/shepherd-api-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
