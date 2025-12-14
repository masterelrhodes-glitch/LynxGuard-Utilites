const preloadStart = process.hrtime.bigint();

const path = require("node:path");
const fs = require("node:fs");

const ENV_PATH = path.join(__dirname, ".env");
if (!fs.existsSync(ENV_PATH)) {
  const TEMPLATE = `# ── Discord ─────────────────────────────────────────────────────────
TOKEN=
APP_ID=
DEV_GUILD_ID=

# ── Database / Retry Strategy ───────────────────────────────────────
MONGO_URI=
DB_MAX_IMMEDIATE_RETRIES=5
DB_SLOW_RETRY_MS=60000
DB_BACKOFF_BASE=1000
DB_MAX_BACKOFF=30000

# ── Commands ────────────────────────────────────────────────────────
PREFIX=-

# ── Feature Toggles (true/false, 1/0, yes/no) ───────────────────────
HOT_RELOAD=false
PROCESS_HANDLERS=true
CHECK_INTENTS=true
CHECK_EVENT_NAMES=true
REGISTER_COMMANDS=true
FANCY_ERRORS=true

# ── Sentry Integration ──────────────────────────────────────────────
SENTRY_API_TOKEN=
`;
  fs.writeFileSync(ENV_PATH, TEMPLATE, { flag: "wx" });
  console.error(
    "[SETUP] Created .env. Fill it out (at least TOKEN + APP_ID + SENTRY_API_TOKEN) then re-run."
  );
  process.exit(1);
}

require("dotenv").config({ path: ENV_PATH });

const Log = require("./Utils/Logs");
const config = require("./config.js");

const ConfigTemplate = {
  TOKEN: "string",
  APP_ID: "string",
  DEV_GUILD_ID: "string",
  MONGO_URI: "string",
  DB_MAX_IMMEDIATE_RETRIES: "number",
  DB_SLOW_RETRY_MS: "number",
  DB_BACKOFF_BASE: "number",
  DB_MAX_BACKOFF: "number",
  PREFIX: "string",
  HOT_RELOAD: "boolean",
  PROCESS_HANDLERS: "boolean",
  CHECK_INTENTS: "boolean",
  CHECK_EVENT_NAMES: "boolean",
  REGISTER_COMMANDS: "boolean",
  FANCY_ERRORS: "boolean",
};

for (const [key, type] of Object.entries(ConfigTemplate)) {
  if (!(key in config)) {
    Log.error(`[~] Missing ${key} in config.json`);
    process.exit(1);
  }
  if (typeof config[key] !== type) {
    Log.error(
      `[~] Expected ${key} to be a ${type} in config.json - Got ${typeof config[key]} instead`
    );
    process.exit(1);
  }
}

const { existsSync, readFileSync } = require("node:fs");
const { writeFile, lstat } = require("node:fs/promises");

const ComponentLoader = require("./Utils/ComponentLoader");
const EventLoader = require("./Utils/EventLoader");
const RegisterCommands = require("./Utils/RegisterCommands");
const FileWatch = require("./Utils/FileWatcher");
const CheckIntents = require("./Utils/CheckIntents");
const setupDatabase = require("./Database/connect");
const initProcessHandlers = require("./Utils/ProcessHandler");

const { Client } = require("discord.js");
const Debounce = require("./Utils/Debounce");
const { RESPONSE_CACHE } = require("./Events/InteractionHandler");
const { resolve } = require("node:path");
const SentryPoller = require('./SentryPoller');

require("./Utils/ProcessHandler");

const preloadEnd = process.hrtime.bigint();
const preloadTime = Number(preloadEnd - preloadStart) / 1e6;
Log.custom(`Preload time: ${~~preloadTime}ms`, 0x7946ff);

const client = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent"],
});

client.config = config;
client.logs = Log;
client.cooldowns = new Map();

client.commands = new Map();
client.context = new Map();
client.buttons = new Map();
client.menus = new Map();
client.modals = new Map();
client.messages = new Map();

const COMPONENT_FOLDERS = {
  "./Commands": client.commands,
  "./Buttons": client.buttons,
  "./Menus": client.menus,
  "./Modals": client.modals,
  "./Messages": client.messages,
  "./Context": client.context,
  "./Events": null,
};

const PRESET_FILES = {
  "./Commands": "./Presets/Command",
  "./Buttons": "./Presets/Button",
  "./Menus": "./Presets/Menu",
  "./Modals": "./Presets/Modal",
  "./Messages": "./Presets/Message",
  "./Context": "./Presets/Context",
  "./Events": "./Presets/Event",
};

for (const [componentFolder, presetFile] of Object.entries(PRESET_FILES)) {
  const fullPath = `${__dirname}/${presetFile}`;
  if (!existsSync(fullPath)) {
    Log.error(
      `The preset "${presetFile}" file does not exist - Check the relative path!`
    );
    PRESET_FILES[componentFolder] = null;
    continue;
  }

  if (!(componentFolder in COMPONENT_FOLDERS)) {
    Log.error(
      `The folder "${componentFolder}" does not exist in the COMPONENT_FOLDERS lookup`
    );
    PRESET_FILES[componentFolder] = null;
    continue;
  }

  const data = readFileSync(fullPath, "utf-8");
  if (data.length > 0) PRESET_FILES[componentFolder] = data;
}

for (const [path, cache] of Object.entries(COMPONENT_FOLDERS)) {
  const fullPath = `${__dirname}/${path}`;
  if (cache === null) {
    ResetEvents(path);
    continue;
  }

  if (!cache) {
    Log.error(`No cache found for ${path}`);
    continue;
  }

  if (!existsSync(fullPath)) {
    Log.error(
      `The '${path.split("/")[1]}' folder does not exist - Check the relative path!`
    );
    delete COMPONENT_FOLDERS[path];
    delete PRESET_FILES[path];
    continue;
  }

  ComponentLoader(path, cache);
  Log.debug(`Loaded ${cache.size} ${path.split("/")[1]}`);
}

if (config.CHECK_INTENTS) {
  CheckIntents(client);
} else {
  Log.warn("Intent checking is disabled in config.json");
}

RegisterCommands(client);

function ResetEvents(path) {
  client.removeAllListeners();
  EventLoader(client, path);
  let ListenerCount = 0;
  for (const listeners of Object.values(client._events)) {
    ListenerCount += listeners.length;
  }
  Log.debug(`Loaded ${ListenerCount} events`);
}

async function HotReload(cache, componentFolder, filePath, type = 0) {
  if (type !== 0) return;

  try {
    const stat = await lstat(filePath);
    if (stat.isDirectory()) return;
    if (stat.isSymbolicLink()) return;
  } catch (err) {
    if (!filePath.endsWith(".js")) return;
  }

  delete require.cache[resolve(filePath)];

  if (!existsSync(filePath)) {
    if (cache === null) {
      ResetEvents(componentFolder);
      return;
    }
    cache.clear();
    ComponentLoader(componentFolder, cache);
    await RegisterCommands(client);
    return;
  }

  const isEvent = cache === null;

  const oldComponent = require(filePath);

  if (isEvent) {
    ResetEvents(componentFolder);
    return;
  }

  cache.clear();

  ComponentLoader(componentFolder, cache);
  Log.debug(`Loaded ${cache.size} ${componentFolder.split("/")[1]}`);

  const newComponent = require(filePath);

  if (cache == client.commands) {
    const oldCommandData = oldComponent.data?.toJSON() ?? {};
    const newCommandData = newComponent.data?.toJSON() ?? {};
    if (JSON.stringify(oldCommandData) !== JSON.stringify(newCommandData)) {
      await RegisterCommands(client);
    }
    if (oldComponent.aliases && newComponent.aliases) {
      const oldAliases = oldComponent.aliases.sort((a, b) =>
        a.localeCompare(b)
      );
      const newAliases = newComponent.aliases.sort((a, b) =>
        a.localeCompare(b)
      );
      if (JSON.stringify(oldAliases) !== JSON.stringify(newAliases)) {
        await RegisterCommands(client);
      }
    }
  }

  RESPONSE_CACHE.clear();
}

async function PresetFile(cache, componentFolder, callback, filePath) {
  const presetData = PRESET_FILES[componentFolder];
  if (!presetData) return;

  const fileStats = await lstat(filePath);
  if (fileStats.isDirectory()) return;
  if (fileStats.isSymbolicLink()) return;

  if (fileStats.size === 0) {
    await writeFile(filePath, presetData);
  }

  callback(filePath);
}

const sentryPoller = new SentryPoller(client);

(async () => {
  try {
    await setupDatabase(client);
    initProcessHandlers(client);
  } catch (e) {
    Log.error(`[DB] failed to initialize: ${e?.message || e}`);
  }

  Log.info(`Logging in...`);
  client.login(client.config.TOKEN);
})();

client.on("clientReady", function () {
  Log.custom(`Logged in as ${client.user.tag}!`, 0x7946ff);
  
  sentryPoller.start();
  
  if (!config.HOT_RELOAD) {
    Log.warn("Hot reload is disabled in config.json");
    return;
  }

  for (const [path, cache] of Object.entries(COMPONENT_FOLDERS)) {
    const fullPath = `${__dirname}/${path}`;
    const watcher = new FileWatch(fullPath, true);
    const callback = Debounce(HotReload.bind(null, cache, path), 1_000);
    watcher.onAdd = PresetFile.bind(null, cache, path, callback);
    watcher.onRemove = callback;
    watcher.onChange = callback;
  }
});