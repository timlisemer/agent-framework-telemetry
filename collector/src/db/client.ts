import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: (notice) => {
    console.log("[DB Notice]", notice.message);
  },
});

export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error("[DB] Health check failed:", error);
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  console.log("[DB] Closing database connections...");
  await sql.end({ timeout: 5 });
  console.log("[DB] Database connections closed");
}

// Graceful shutdown handlers
let shutdownInProgress = false;

async function handleShutdown(signal: string): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  console.log(`[DB] Received ${signal}, initiating graceful shutdown...`);
  await closeConnection();
  process.exit(0);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
