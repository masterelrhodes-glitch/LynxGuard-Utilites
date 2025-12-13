const Log = require("./Logs");
const { PROCESS_HANDLERS } = require("../config.js");

module.exports = function initProcessHandlers(client) {
  if (!PROCESS_HANDLERS) {
    Log.warn("Process handlers are disabled in config.json");
    return;
  }

  async function tryDbClose(reason) {
    try {
      const state = client?.connection?.state?.() ?? "unknown";
      Log.warn(
        `[DB] ${reason}: attempting graceful disconnect (state=${state})`
      );
      if (client?.connection?.disconnect) {
        await client.connection.disconnect();
      }
    } catch (e) {
      Log.error(`[DB] graceful disconnect failed: ${e?.message || e}`);
    }
  }

  process.on("SIGINT", async () => {
    console.log();
    Log.error("SIGINT: Exiting...");
    await tryDbClose("SIGINT");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    Log.error("SIGTERM: Exiting...");
    await tryDbClose("SIGTERM");
    process.exit(0);
  });

  process.on("uncaughtException", (err) => {
    Log.error(`UNCAUGHT EXCEPTION: ${err?.stack || err}`);
  });

  process.on("unhandledRejection", (err) => {
    Log.error(`UNHANDLED REJECTION: ${err?.stack || err}`);
  });

  process.on("warning", (warning) => {
    Log.warn(`WARNING: ${warning.name} : ${warning.message}`);
  });

  process.on("uncaughtReferenceError", (err) => {
    Log.error(err);
  });

  process.on("beforeExit", async (code) => {
    await tryDbClose(`beforeExit code=${code}`);
  });

  process.on("exit", (code) => {
    Log.info(`Process exit code=${code}`);
  });
};
