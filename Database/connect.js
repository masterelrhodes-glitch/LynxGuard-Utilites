const mongoose = require("mongoose");
const Log = require("../Utils/Logs");

const STATE = ["disconnected", "connected", "connecting", "disconnecting"];

function dbLogEnabled(client) {
  return !!client?.config?.DB_LOGGING;
}

function j(v) {
  try {
    return JSON.stringify(v, (_, x) =>
      x instanceof RegExp ? x.toString() : x
    );
  } catch {
    return String(v);
  }
}

function opLogPlugin(schema) {
  schema.post("save", function (doc) {
    if (dbLogEnabled(globalThis.__dbClient))
      Log.created(`[DB] ${this.constructor.modelName} created _id=${doc?._id}`);
  });

  schema.post("insertMany", function (docs) {
    if (dbLogEnabled(globalThis.__dbClient))
      Log.created(
        `[DB] ${this.modelName || "Model"}.insertMany count=${
          docs?.length ?? 0
        }`
      );
  });

  function logUpdate(ctx, res, hook) {
    if (!dbLogEnabled(globalThis.__dbClient)) return;

    try {
      const model =
        ctx.model?.modelName || ctx.constructor?.modelName || "Model";
      const filter = ctx.getFilter ? ctx.getFilter() : {};
      const update = ctx.getUpdate ? ctx.getUpdate() : {};
      const ops = Object.keys(update || {});
      const pushed = Object.keys(update?.$push || {});
      const matched = res?.matchedCount ?? res?.n ?? undefined;
      const modified = res?.modifiedCount ?? res?.nModified ?? undefined;
      const upsertedId = res?.upsertedId || res?.upserted || undefined;

      const pushNote = pushed.length ? ` pushed=[${pushed.join(", ")}]` : "";
      Log.updated(
        `[DB] ${model}.${hook} matched=${matched ?? "?"} modified=${
          modified ?? "?"
        } upserted=${j(upsertedId)} ops=[${ops.join(
          ", "
        )}]${pushNote} filter=${j(filter)} update=${j(update)}`
      );
    } catch (e) {
      if (dbLogEnabled(globalThis.__dbClient))
        Log.warn(`[DB] update log failed: ${e?.message || e}`);
    }
  }

  schema.post("updateOne", { document: false, query: true }, function (res) {
    logUpdate(this, res, "updateOne");
  });
  schema.post("updateMany", { document: false, query: true }, function (res) {
    logUpdate(this, res, "updateMany");
  });
  schema.post(
    "findOneAndUpdate",
    { document: false, query: true },
    function () {
      logUpdate(this, undefined, "findOneAndUpdate");
    }
  );
  schema.post("replaceOne", { document: false, query: true }, function (res) {
    logUpdate(this, res, "replaceOne");
  });

  schema.post("deleteOne", { document: false, query: true }, function (res) {
    if (!dbLogEnabled(globalThis.__dbClient)) return;
    try {
      const model = this.model?.modelName || "Model";
      const filter = this.getFilter ? this.getFilter() : {};
      Log.deleted(
        `[DB] ${model}.deleteOne deleted=${res?.deletedCount ?? 0} filter=${j(
          filter
        )}`
      );
    } catch (e) {
      Log.warn(`[DB] deleteOne log failed: ${e?.message || e}`);
    }
  });

  schema.post("deleteMany", { document: false, query: true }, function (res) {
    if (!dbLogEnabled(globalThis.__dbClient)) return;
    try {
      const model = this.model?.modelName || "Model";
      const filter = this.getFilter ? this.getFilter() : {};
      Log.deleted(
        `[DB] ${model}.deleteMany deleted=${res?.deletedCount ?? 0} filter=${j(
          filter
        )}`
      );
    } catch (e) {
      Log.warn(`[DB] deleteMany log failed: ${e?.message || e}`);
    }
  });

  schema.post(
    "findOneAndDelete",
    { document: false, query: true },
    function () {
      if (!dbLogEnabled(globalThis.__dbClient)) return;
      try {
        const model = this.model?.modelName || "Model";
        const filter = this.getFilter ? this.getFilter() : {};
        Log.deleted(`[DB] ${model}.findOneAndDelete filter=${j(filter)}`);
      } catch (e) {
        Log.warn(`[DB] findOneAndDelete log failed: ${e?.message || e}`);
      }
    }
  );
}

let pluginApplied = false;

async function setupDatabase(client) {
  globalThis.__dbClient = client;

  const uri = client?.config?.MONGO_URI;

  if (!uri || typeof uri !== "string" || uri.trim() === "") {
    if (dbLogEnabled(client))
      Log.warn("[DB] MONGO_URI is missing/empty in config.json (DB disabled)");

    const disabledApi = {
      uri: null,
      state: () => "disabled",
      effectiveState: () => "disabled",
      rawState: () => "disabled",
      mongoose,
      conn: null,
      models: mongoose.models,
      connect: async () =>
        dbLogEnabled(client) &&
        Log.warn("[DB] connect() called but DB is disabled"),
      disconnect: async () =>
        dbLogEnabled(client) &&
        Log.warn("[DB] disconnect() called but DB is disabled"),
      reconnect: async () =>
        dbLogEnabled(client) &&
        Log.warn("[DB] reconnect() called but DB is disabled"),
      withTransaction: async () => {
        throw new Error("DB disabled");
      },
      stopReconnect: () => {},
      retryState: () => ({
        attempts: 0,
        mode: "off",
        loopActive: false,
        stopped: true,
      }),
      isConnected: () => false,
    };
    client.database = disabledApi;
    client.connection = disabledApi;
    return client.database;
  }

  if (!pluginApplied && dbLogEnabled(client)) {
    mongoose.plugin(opLogPlugin);
    pluginApplied = true;
  }

  if (dbLogEnabled(client)) {
    mongoose.set("debug", (coll, method, query, doc) => {
      const writes = new Set([
        "insertMany",
        "update",
        "updateOne",
        "updateMany",
        "findOneAndUpdate",
        "deleteOne",
        "deleteMany",
        "replaceOne",
        "save",
      ]);
      if (!writes.has(method)) return;
      const pushed = !!(doc?.$push || query?.$push);
      Log.debug(
        `[DB][${coll}] ${method}${pushed ? " [PUSH]" : ""} query=${j(
          query
        )} doc=${j(doc)}`
      );
    });
  }

  const MAX_IMMEDIATE = Number(client.config.DB_MAX_IMMEDIATE_RETRIES ?? 5);
  const SLOW_RETRY_MS = Number(client.config.DB_SLOW_RETRY_MS ?? 60_000);
  const BACKOFF_BASE = Number(client.config.DB_BACKOFF_BASE ?? 1000);
  const MAX_BACKOFF = Number(client.config.DB_MAX_BACKOFF ?? 30_000);

  let attempts = 0;
  let retryTimer = null;
  let loopActive = false;
  let stopped = false;

  let lastPhase = "fast";
  let slowModeSince = null;
  let slowOverrideActive = false;

  const connectOpts = {
    maxPoolSize: 20,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    retryWrites: true,
    family: 4,
  };

  function enterFastMode() {
    if (dbLogEnabled(client) && lastPhase !== "fast") {
      Log.info("[DB] leaving slow retry mode");
    }
    lastPhase = "fast";
    slowModeSince = null;
    slowOverrideActive = false;
  }

  function enterSlowMode() {
    if (dbLogEnabled(client) && lastPhase !== "slow") {
      slowModeSince = Date.now();
      Log.warn(
        `[DB] entering slow retry mode after ${Math.max(
          0,
          attempts - 1
        )} failed attempts`
      );
    }
    lastPhase = "slow";
    slowOverrideActive = true;
  }

  function computeDelay() {
    if (attempts <= MAX_IMMEDIATE) {
      enterFastMode();
      const exp = Math.min(
        BACKOFF_BASE * Math.pow(2, Math.max(0, attempts - 1)),
        MAX_BACKOFF
      );
      return exp;
    }
    enterSlowMode();
    return SLOW_RETRY_MS;
  }

  async function connectOnce() {
    if (stopped) return;
    attempts++;
    let host = "unknown";
    try {
      host = new URL(uri).host;
    } catch {}
    if (dbLogEnabled(client))
      Log.info(`[DB] connecting attempt=${attempts} host=${host}`);

    await mongoose.connect(uri, connectOpts);
  }

  async function startLoop() {
    if (loopActive || stopped) return;
    loopActive = true;

    while (!stopped) {
      try {
        await connectOnce();
        attempts = 0;
        enterFastMode();
        loopActive = false;
        return;
      } catch (err) {
        if (dbLogEnabled(client)) {
          const msg = err?.message || String(err);
          Log.error(`[DB] connect error: ${msg}`);
        }

        const delay = computeDelay();

        if (dbLogEnabled(client))
          Log.warn(
            `[DB] retrying in ${delay}ms (${
              attempts <= MAX_IMMEDIATE ? "fast" : "slow"
            } mode)`
          );

        await new Promise((r) => {
          retryTimer = setTimeout(r, delay);
        });
        retryTimer = null;
      }
    }

    loopActive = false;
  }

  function ensureLoop() {
    if (stopped) return;
    if (!loopActive) {
      void startLoop();
    }
  }

  const conn = mongoose.connection;

  conn.on("connecting", () => {
    if (dbLogEnabled(client)) Log.info("[DB] connecting...");
  });

  conn.on("connected", () => {
    if (dbLogEnabled(client))
      Log.success(`[DB] connected db=${conn?.name} host=${conn?.host}`);
    attempts = 0;
    enterFastMode();
  });

  conn.once("open", () => {
    if (dbLogEnabled(client)) Log.success("[DB] initial connection opened");

    if (dbLogEnabled(client)) {
      try {
        const cs = conn.db.watch([], { fullDocument: "updateLookup" });
        cs.on("change", (evt) => {
          const ns = `${evt.ns?.db}.${evt.ns?.coll}`;
          const op = evt.operationType;
          const id = evt.documentKey?._id;

          if (op === "insert") Log.created(`[DB][CS] ${ns} insert _id=${id}`);
          else if (op === "update" || op === "replace")
            Log.updated(`[DB][CS] ${ns} ${op} _id=${id}`);
          else if (op === "delete")
            Log.deleted(`[DB][CS] ${ns} delete _id=${id}`);
          else Log.debug(`[DB][CS] ${ns} ${op}`);
        });
        cs.on("error", (e) => Log.warn(`[DB][CS] error: ${e?.message || e}`));
        Log.info("[DB] change stream attached");
      } catch {
        Log.warn(
          "[DB] change streams not available; plugin hooks still log ops"
        );
      }
    }
  });

  conn.on("disconnected", () => {
    if (dbLogEnabled(client)) Log.warn("[DB] disconnected");
    ensureLoop();
    if (lastPhase === "slow") slowOverrideActive = true;
  });

  conn.on("reconnected", () => {
    if (dbLogEnabled(client)) Log.success("[DB] reconnected");
    attempts = 0;
    enterFastMode();
  });

  conn.on("error", (err) => {
    if (dbLogEnabled(client))
      Log.error(`[DB] connection error: ${err?.message || err}`);
  });

  try {
    mongoose.connection.getClient().on("topologyDescriptionChanged", (ev) => {
      if (dbLogEnabled(client)) {
        const type = ev?.newDescription?.type;
        Log.debug(`[DB] topology changed type=${type}`);
      }
    });
  } catch {}

  const api = {
    uri,
    mongoose,
    conn,
    models: mongoose.models,

    state: () => {
      const rs = conn.readyState;
      const mapped = STATE[rs] || String(rs);
      if (slowOverrideActive && rs !== 1) return "disconnected";
      return mapped;
    },

    effectiveState: () => {
      const rs = conn.readyState;
      return slowOverrideActive && rs !== 1
        ? "disconnected"
        : STATE[rs] || String(rs);
    },

    rawState: () => STATE[conn.readyState] || String(conn.readyState),

    isConnected: () => conn.readyState === 1,

    connect: async () => {
      stopped = false;
      attempts = 0;
      enterFastMode();
      ensureLoop();
      return conn;
    },

    disconnect: async () => {
      try {
        stopped = true;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        await mongoose.disconnect();
        if (dbLogEnabled(client)) Log.info("[DB] disconnected by request");
      } catch (e) {
        if (dbLogEnabled(client))
          Log.error(`[DB] disconnect error: ${e?.message || e}`);
      }
    },

    reconnect: async (delayMs = 250) => {
      await api.disconnect();
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      stopped = false;
      attempts = 0;
      enterFastMode();
      ensureLoop();
      return conn;
    },

    withTransaction: async (fn, opts = {}) => {
      const session = await mongoose.startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          result = await fn(session);
        }, opts);
        return result;
      } finally {
        await session.endSession();
      }
    },

    stopReconnect: () => {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (dbLogEnabled(client)) Log.warn("[DB] auto-reconnect stopped");
    },

    retryState: () => ({
      attempts,
      mode: lastPhase,
      slowModeSince,
      loopActive,
      stopped,
      slowOverrideActive,
    }),
  };

  client.database = api;
  client.connection = api;

  api.connect();

  return api;
}

module.exports = setupDatabase;
module.exports.opLogPlugin = opLogPlugin;
