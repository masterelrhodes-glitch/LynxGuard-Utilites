const CheckCooldown = require("../Utils/Checks/Cooldown");
const GuildOwner = require("../Utils/Checks/GuildOwner");
const IDAccess = require("../Utils/Checks/IDAccess");
const RoleAccess = require("../Utils/Checks/RoleAccess");
const Permission = require("../Utils/Checks/Permissions");

const ErrorParse = require("../Utils/FindError");

const { FANCY_ERRORS } = require("../config.js");
const { MessageFlags } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  execute: async function (client, interaction) {
    const BoundHandler = InteractionHandler.bind(null, client, interaction);

    switch (interaction.type) {
      case 4:
      case 2:
        if (interaction.commandType === 1) {
          const subcommand = interaction.options._subcommand || "";
          const subcommandGroup = interaction.options._subcommandGroup || "";
          const commandArgs = interaction.options._hoistedOptions || [];
          const args = `${subcommandGroup} ${subcommand} ${commandArgs
            .map((arg) => arg.value)
            .join(" ")}`.trim();
          client.logs.info(
            `${interaction.user.tag} (${interaction.user.id}) > /${interaction.commandName} ${args}`
          );
          await BoundHandler("commands", client.commands);
        } else {
          client.logs.info(
            `${interaction.user.tag} (${interaction.user.id}) > :${interaction.commandName}:`
          );
          await BoundHandler("context", client.context);
        }
        break;
      case 3:
        if (interaction.isButton()) {
          console.log('[BUTTON DEBUG] ==========================================');
          console.log('[BUTTON DEBUG] Button clicked!');
          console.log('[BUTTON DEBUG] customId:', interaction.customId);
          console.log('[BUTTON DEBUG] Available buttons:', Array.from(client.buttons.keys()));
          
          // Check if button exists with FULL customId first (no splitting)
          if (client.buttons.has(interaction.customId)) {
            console.log('[BUTTON DEBUG] ✅ Found button with full customId:', interaction.customId);
            console.log('[BUTTON DEBUG] ==========================================');
            
            client.logs.info(
              `${interaction.user.tag} (${interaction.user.id}) > [${interaction.customId}]`
            );
            await BoundHandler("buttons", client.buttons, true); // Pass flag to skip splitting
          } else {
            // If not found, try splitting by underscore
            console.log('[BUTTON DEBUG] Full customId not found, trying split...');
            console.log('[BUTTON DEBUG] Split args:', interaction.customId?.split("_"));
            const testArgs = interaction.customId?.split("_") ?? [];
            const testName = testArgs.shift();
            console.log('[BUTTON DEBUG] Looking for button named:', testName);
            console.log('[BUTTON DEBUG] Button exists?', client.buttons.has(testName));
            if (client.buttons.has(testName)) {
              const btn = client.buttons.get(testName);
              console.log('[BUTTON DEBUG] Button customID:', btn.customID);
              console.log('[BUTTON DEBUG] Has execute?', typeof btn.execute === 'function');
            }
            console.log('[BUTTON DEBUG] ==========================================');
            
            client.logs.info(
              `${interaction.user.tag} (${interaction.user.id}) > [${interaction.customId}]`
            );
            await BoundHandler("buttons", client.buttons, false); // Use splitting
          }
        } else if (interaction.isAnySelectMenu()) {
          client.logs.info(
            `${interaction.user.tag} (${interaction.user.id}) > <${interaction.customId}>`
          );
          await BoundHandler("menus", client.menus);
        }
        break;
      case 5:
        client.logs.info(
          `${interaction.user.tag} (${interaction.user.id}) > {${interaction.customId}}`
        );
        await BoundHandler("modals", client.modals);
        break;
      default:
        client.logs.warn(
          `Unknown interaction type: ${interaction.type} - Unsure how to handle this...`
        );
        break;
    }
  },
};

const RESPONSE_CACHE = new Map();

module.exports.RESPONSE_CACHE = RESPONSE_CACHE;

function CacheKey(name, options) {
  if (options === null || options === undefined) return name;
  options.sort((a, b) => a.name.localeCompare(b.name));
  const optionKey = options.map((x) => x.name + "-" + x.value).join("_");
  return `${name}_${optionKey}`;
}

async function InteractionHandler(client, interaction, type, cache, skipSplit = false) {
  let args = [];
  let name;

  if (skipSplit) {
    // Use the full customId without splitting
    name = interaction.customId ?? interaction.commandName;
    args = [];
  } else {
    // Split the customId for args
    args = interaction.customId?.split("_") ?? [];
    name = args.shift() ?? interaction.commandName;
  }

  console.log(`[HANDLER DEBUG] Type: ${type}, Name: ${name}, Args:`, args, `SkipSplit: ${skipSplit}`);

  const component = cache.get(name);
  if (!component) {
    console.log(`[HANDLER DEBUG] Component not found for name: ${name}`);
    await interaction
      .reply({
        content: `There was an error while executing this command!\n\`\`\`Command not found\`\`\``,
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    client.logs.error(`${type} not found: ${name}`);
    return;
  }

  console.log(`[HANDLER DEBUG] Component found! customID: ${component.customID}`);

  const key = CacheKey(name, interaction.options?._hoistedOptions);
  if (RESPONSE_CACHE.has(key)) {
    const data = RESPONSE_CACHE.get(key);
    await interaction.reply(...data).catch(() => {});
    return;
  }

  if ("defer" in component && component.defer !== null) {
    await interaction
      .deferReply({
        flags: component.defer ? MessageFlags.Ephemeral : null,
      })
      .catch(() => {});
  }

  try {
    if (component.cooldown)
      CheckCooldown(client, interaction.user.id, name, component.cooldown);
    if (component.guilds)
      IDAccess(component.guilds, interaction.guildId, "Guild");
    if (component.channels)
      IDAccess(component.channels, interaction.channelId, "Channel");
    if (component.users) IDAccess(component.users, interaction.user.id, "User");
    if (component.owner)
      GuildOwner(interaction.guild?.ownerId, interaction.user.id);
    if (component.roles) RoleAccess(component.roles, interaction.member);

    if (component.botPerms || component.userPerms) {
      if (!interaction.guild)
        throw ["This command cannot be used in DMs", "DMs"];
      if (!interaction.user)
        throw ["This command cannot be used in DMs", "DMs"];
      const botMember = interaction.guild
        ? interaction.guild.members.cache.get(client.user.id) ??
          (await interaction.guild.members
            .fetch(client.user.id)
            .catch(() => null))
        : null;
      if (botMember !== null) {
        Permission(client, component.botPerms, botMember);
        Permission(client, component.userPerms, interaction.member);
      }
    }
  } catch (error) {
    await interaction
      .deferReply({ flags: MessageFlags.Ephemeral })
      .catch(() => {});
    const payload = {
      content: "",
      embeds: [],
      components: [],
      files: [],
    };
    if (Array.isArray(error)) {
      const [response, reason] = error;
      payload.content = response;
      client.logs.error(`Blocked user from ${type}: ${reason}`);
    } else {
      payload.content = `There was an error while executing this command!\n\`\`\`${error}\`\`\``;
      client.logs.error(error);
    }
    await interaction.editReply(payload).catch(() => {});
    return;
  }

  let timeout;
  if (!interaction.isAutocomplete()) {
    const cancelAutoDefer = () => {
      if (!timeout) return;
      clearTimeout(timeout);
      timeout = undefined;
    };

    const oldReply = interaction.reply.bind(interaction);
    const oldEdit = interaction.editReply.bind(interaction);
    interaction.reply = function (...args) {
      if (component.cache) RESPONSE_CACHE.set(key, args);
      cancelAutoDefer();
      const callback =
        interaction.deferred || interaction.replied ? oldEdit : oldReply;
      return callback(...args);
    };
    interaction.editReply = function (...args) {
      if (component.cache) RESPONSE_CACHE.set(key, args);
      cancelAutoDefer();
      return oldEdit(...args);
    };

    if (typeof interaction.deferReply === "function") {
      const oldDefer = interaction.deferReply.bind(interaction);
      interaction.deferReply = function (...args) {
        cancelAutoDefer();
        return oldDefer(...args);
      };
    }

    if (typeof interaction.showModal === "function") {
      const oldShowModal = interaction.showModal.bind(interaction);
      interaction.showModal = async function (...args) {
        cancelAutoDefer();
        const response = await oldShowModal(...args);
        interaction.replied = true;
        return response;
      };
    }

    timeout = setTimeout(() => {
      if (interaction.deferred || interaction.replied) return;
      interaction.deferReply().catch((error) => {
        if (error?.code === 10062) return;
        client.logs?.debug?.(
          `Auto-defer failed for ${type}:${name} - ${error?.message || error}`
        );
      });
    }, 1000);
  }

  try {
    console.log('[HANDLER DEBUG] About to execute component...');
    const callback = interaction.isAutocomplete()
      ? component.autocomplete
      : component.execute;
    if (typeof callback !== "function") throw new "Command not implemented"();
    await callback(interaction, client, type === "commands" ? undefined : args);
    console.log('[HANDLER DEBUG] Component executed successfully!');
    clearTimeout(timeout);
  } catch (error) {
    clearTimeout(timeout);
    RESPONSE_CACHE.delete(key);
    client.logs.error(error);
    console.log('[HANDLER DEBUG] Error executing component:', error);

    await interaction
      .deferReply({ flags: MessageFlags.Ephemeral })
      .catch(() => {});

    if (!FANCY_ERRORS || !(error instanceof Error)) {
      await interaction
        .editReply({
          content: `There was an error while executing this command!\n\`\`\`${error}\`\`\``,
          embeds: [],
          components: [],
          files: [],
        })
        .catch(() => {});
    } else {
      const errorData = ErrorParse(error);
      if (errorData) {
        const embed = {
          color: 0xff0000,
          description: `
	Command: \`${name}\`
	Error: \`${errorData.message}\`
	\`\`\`\n${errorData.lines.join("\n")}\`\`\``,
        };
        await interaction
          .editReply({
            content: "",
            embeds: [embed],
            components: [],
            files: [],
          })
          .catch(() => {});
        return;
      }
    }
  }
}