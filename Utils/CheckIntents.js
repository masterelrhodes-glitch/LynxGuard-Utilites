const Logs = require("./Logs");
const { GatewayIntentBits } = require("discord-api-types/v10");
const { BitField } = require("discord.js");
const { CHECK_INTENTS } = require("../config.js");

class IntentsBitField extends BitField {
  static Flags = GatewayIntentBits;
}

const REQUIRED_INTENTS = {
  guildCreate: [GatewayIntentBits.Guilds],
  guildUpdate: [GatewayIntentBits.Guilds],
  guildDelete: [GatewayIntentBits.Guilds],
  channelCreate: [GatewayIntentBits.Guilds],
  channelUpdate: [GatewayIntentBits.Guilds],
  channelDelete: [GatewayIntentBits.Guilds],
  channelPinsUpdate: [GatewayIntentBits.Guilds],
  threadCreate: [GatewayIntentBits.Guilds],
  threadUpdate: [GatewayIntentBits.Guilds],
  threadDelete: [GatewayIntentBits.Guilds],
  threadListSync: [GatewayIntentBits.Guilds],
  threadMemberUpdate: [GatewayIntentBits.Guilds],
  threadMembersUpdate: [GatewayIntentBits.Guilds],
  stageInstanceCreate: [GatewayIntentBits.Guilds],
  stageInstanceUpdate: [GatewayIntentBits.Guilds],
  stageInstanceDelete: [GatewayIntentBits.Guilds],
  guildMemberAdd: [GatewayIntentBits.GuildMembers],
  guildMemberUpdate: [GatewayIntentBits.GuildMembers],
  guildMemberRemove: [GatewayIntentBits.GuildMembers],
  guildAuditLogEntryCreate: [GatewayIntentBits.GuildModeration],
  guildBanAdd: [GatewayIntentBits.GuildModeration],
  guildBanRemove: [GatewayIntentBits.GuildModeration],
  guildEmojisUpdate: [GatewayIntentBits.GuildEmojisAndStickers],
  guildStickersUpdate: [GatewayIntentBits.GuildEmojisAndStickers],
  guildIntegrationsUpdate: [GatewayIntentBits.GuildIntegrations],
  integrationCreate: [GatewayIntentBits.GuildIntegrations],
  integrationUpdate: [GatewayIntentBits.GuildIntegrations],
  integrationDelete: [GatewayIntentBits.GuildIntegrations],
  webhooksUpdate: [GatewayIntentBits.GuildWebhooks],
  inviteCreate: [GatewayIntentBits.GuildInvites],
  inviteDelete: [GatewayIntentBits.GuildInvites],
  voiceStateUpdate: [GatewayIntentBits.GuildVoiceStates],
  presenceUpdate: [GatewayIntentBits.GuildPresences],
  messageCreate: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  messageUpdate: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  messageDelete: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  messageDeleteBulk: [GatewayIntentBits.GuildMessages],
  messageReactionAdd: [GatewayIntentBits.GuildMessageReactions],
  messageReactionRemove: [GatewayIntentBits.GuildMessageReactions],
  messageReactionRemoveAll: [GatewayIntentBits.GuildMessageReactions],
  messageReactionRemoveEmoji: [GatewayIntentBits.GuildMessageReactions],
  typingStart: [GatewayIntentBits.GuildMessageTyping],
  guildScheduledEventCreate: [GatewayIntentBits.GuildScheduledEvents],
  guildScheduledEventUpdate: [GatewayIntentBits.GuildScheduledEvents],
  guildScheduledEventDelete: [GatewayIntentBits.GuildScheduledEvents],
  guildScheduledEventUserAdd: [GatewayIntentBits.GuildScheduledEvents],
  guildScheduledEventUserRemove: [GatewayIntentBits.GuildScheduledEvents],
  autoModerationRuleCreate: [GatewayIntentBits.AutoModerationConfiguration],
  autoModerationRuleUpdate: [GatewayIntentBits.AutoModerationConfiguration],
  autoModerationRuleDelete: [GatewayIntentBits.AutoModerationConfiguration],
  autoModerationActionExecution: [GatewayIntentBits.AutoModerationExecution],
};

const EventNames = Object.fromEntries(
  Object.entries(GatewayIntentBits).map(([key, value]) => [value, key])
);

module.exports = function (client) {
  if (!CHECK_INTENTS) return;

  const missingIntents = new Set();

  const intents = Number(client.options.intents.bitfield);
  const eventNames = Object.keys(client._events);
  for (let i = 0; i < eventNames.length; i++) {
    const eventName = eventNames[i];
    const requiredBits = REQUIRED_INTENTS[eventName];
    if (!requiredBits) continue;
    for (let i = 0; i < requiredBits.length; i++) {
      const bit = requiredBits[i];
      if ((intents & bit) > 0) continue;
      missingIntents.add(bit);
    }
  }

  const missingIntentNames = Array.from(missingIntents).map((bit) => {
    return EventNames[bit] ?? "unknown";
  });

  const newIntents =
    intents |
    Array.from(missingIntents).reduce((acc, bit) => acc | bit, intents);

  const newBitField = new IntentsBitField(0);
  for (let i = 0; i < 32; i++) {
    const bit = 1 << i;
    if ((newIntents & bit) === 0) continue;
    newBitField.add(EventNames[bit]);
  }
  newBitField.add("Guilds");
  client.options.intents = newBitField;

  if (missingIntents.size > 0)
    Logs.warn(`Applied missing intents: ${missingIntentNames.join(", ")}`);
};
