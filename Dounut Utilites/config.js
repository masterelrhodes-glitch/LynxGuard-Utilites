try {
  if (!process.env._DOTENV_LOADED) {
    require("dotenv").config({ path: require("path").join(__dirname, ".env") });
    process.env._DOTENV_LOADED = "1";
  }
} catch {}

const asBool = (v, d) => (v == null ? d : /^(1|true|yes|on)$/i.test(String(v)));
const asNum = (v, d) =>
  v == null || v === "" || Number.isNaN(Number(v)) ? d : Number(v);
const asStr = (v, d) => (v == null ? d : String(v));

const config = {
  // Discord
  // just yor basic bot info
  TOKEN: asStr(process.env.TOKEN, ""),
  APP_ID: asStr(process.env.APP_ID, ""),
  DEV_GUILD_ID: asStr(process.env.DEV_GUILD_ID, ""), // leave empty to skip guild only updates

  // Database
  // if this is empty, db disables itself automatically so nothing breaks
  MONGO_URI: asStr(process.env.MONGO_URI, ""),

  // lets you turn db logs on/off so dev mode isn’t flooded
  DB_LOGGING: asBool(process.env.DB_LOGGING, true),

  // how many fast retries before it switches to slow mode
  DB_MAX_IMMEDIATE_RETRIES: asNum(process.env.DB_MAX_IMMEDIATE_RETRIES, 5),

  // slow retry timer
  DB_SLOW_RETRY_MS: asNum(process.env.DB_SLOW_RETRY_MS, 60000),

  // base ms for the fast retry backoff curve
  DB_BACKOFF_BASE: asNum(process.env.DB_BACKOFF_BASE, 1000),

  // max ms the fast backoff can reach
  DB_MAX_BACKOFF: asNum(process.env.DB_MAX_BACKOFF, 30000),

  // Commands
  PREFIX: asStr(process.env.PREFIX, "!"), // basic prefix

  // Feature toggles
  // turns hot reload on/off
  HOT_RELOAD: asBool(process.env.HOT_RELOAD, false),

  // handles shutdown signals so it closes clean
  PROCESS_HANDLERS: asBool(process.env.PROCESS_HANDLERS, true),

  // warns you if you try using an intent you didn't enable
  CHECK_INTENTS: asBool(process.env.CHECK_INTENTS, true),

  // helps catch typos on event names
  CHECK_EVENT_NAMES: asBool(process.env.CHECK_EVENT_NAMES, true),

  // pushes slash commands on startup
  REGISTER_COMMANDS: asBool(process.env.REGISTER_COMMANDS, true),

  // cleaner console errors
  FANCY_ERRORS: asBool(process.env.FANCY_ERRORS, true),
};

module.exports = Object.freeze(config);
