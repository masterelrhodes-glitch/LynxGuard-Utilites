const { 
  SlashCommandBuilder, 
  MessageFlags,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const https = require('https');

async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

const embedSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  embedType: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  threadId: { type: String, required: true },
  discordUserId: { type: String, required: true },
  discordUsername: { type: String, required: true },
  robloxUserId: { type: String, required: true },
  robloxUsername: { type: String, required: true },
  status: { type: String, enum: ['not reviewed', 'staged accepted', 'staged denied', 'accepted', 'denied'], default: 'not reviewed' },
  answers: {
    pastSupport: String,
    serversWorked: String,
    discordJsKnowledge: String,
    question3: String,
    question4: String,
    question5: String,
    question6: String,
    question7: String
  },
  applicationReviewer: { type: String, default: null },
  dateReviewed: { type: Date, default: null },
  applicationNotes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'applications', timestamps: true });

const blacklistSchema = new mongoose.Schema({
  discordUserId: { type: String, required: true, unique: true },
  discordUsername: { type: String, required: true },
  blacklistedBy: { type: String, required: true },
  blacklistedByUsername: { type: String, required: true },
  reason: { type: String, default: 'No reason provided' },
  blacklistedAt: { type: Date, default: Date.now }
}, { collection: 'blacklist', timestamps: true });

const Embed = mongoose.models.Embed || mongoose.model('Embed', embedSchema);
const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);
const Blacklist = mongoose.models.Blacklist || mongoose.model('Blacklist', blacklistSchema);

async function fetchRobloxAvatar(userId) {
  return new Promise((resolve) => {
    https.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data?.[0]?.imageUrl || null);
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('applications')
    .setDescription('Manage applications')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Enable or disable application submissions')
        .addStringOption(option =>
          option
            .setName('state')
            .setDescription('Set application status')
            .setRequired(true)
            .addChoices(
              { name: 'Open - Enable Applications', value: 'open' },
              { name: 'Closed - Disable Applications', value: 'closed' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('manage')
        .setDescription('View and manage pending applications')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('id')
        .setDescription('View an application by ID')
        .addStringOption(option =>
          option
            .setName('application_id')
            .setDescription('The application ID to lookup')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('user')
        .setDescription('View applications by user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to lookup')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'status') {
        await handleStatusCommand(interaction);
      } else if (subcommand === 'manage') {
        await handleManageCommand(interaction);
      } else if (subcommand === 'id') {
        await handleIdCommand(interaction);
      } else if (subcommand === 'user') {
        await handleUserCommand(interaction);
      }

    } catch (error) {
      console.error('[APPLICATIONS] Error executing command:', error);
      
      const errorMessage = {
        content: `An error occurred: ${error.message}`,
        flags: MessageFlags.Ephemeral
      };

      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};

async function handleStatusCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await connectDB();

  const state = interaction.options.getString('state');
  const isOpen = state === 'open';

  const embedDoc = await Embed.findOne({
    guildId: interaction.guildId,
    embedType: 'information'
  });

  if (!embedDoc) {
    return await interaction.editReply({
      content: 'No information embed found. Please send one using `/embeds type:information` first.',
      flags: MessageFlags.Ephemeral
    });
  }

  console.log('[APPLICATIONS STATUS] Found embed:', embedDoc.messageId);

  const channel = await interaction.client.channels.fetch(embedDoc.channelId);
  const message = await channel.messages.fetch(embedDoc.messageId);

  const components = message.components;
  
  const lastRow = components[components.length - 1];
  const buttonComponents = lastRow.components.map(component => {
    if (component.customId === 'apply_button') {
      return {
        type: 2,
        style: isOpen ? ButtonStyle.Secondary : ButtonStyle.Secondary,
        label: 'Application',
        custom_id: 'apply_button',
        disabled: !isOpen
      };
    }
    return component.toJSON ? component.toJSON() : component;
  });

  const updatedComponents = [...components.slice(0, -1), {
    type: 1,
    components: buttonComponents
  }];

  await message.edit({ components: updatedComponents });

  console.log('[APPLICATIONS STATUS] Updated button state to:', state);

  await interaction.editReply({
    content: `Applications are now **${isOpen ? 'OPEN' : 'CLOSED'}**. The application button has been ${isOpen ? 'enabled' : 'disabled'}.`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleManageCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await connectDB();

  const stagedApplications = await Application.find({
    status: { $in: ['staged accepted', 'staged denied'] }
  }).limit(10).lean();

  const unreviewedApplications = await Application.find({
    status: 'not reviewed'
  }).limit(10).lean();

  const totalApplications = stagedApplications.length + unreviewedApplications.length;

  if (totalApplications === 0) {
    return await interaction.editReply({
      content: 'No pending applications found.',
      flags: MessageFlags.Ephemeral
    });
  }

  console.log('[APPLICATIONS MANAGE] Found', totalApplications, 'applications');

  const statusMap = {
    'not reviewed': 'Unreviewed',
    'staged accepted': 'Staged Accepted',
    'staged denied': 'Staged Denied',
    'accepted': 'Accepted',
    'denied': 'Denied'
  };

  let description = '';

  if (stagedApplications.length > 0) {
    description += '## Staged Applications\n';
    for (const app of stagedApplications) {
      const user = await interaction.client.users.fetch(app.discordUserId).catch(() => null);
      const reviewer = app.applicationReviewer ? await interaction.client.users.fetch(app.applicationReviewer).catch(() => null) : null;
      const outcome = app.status === 'staged accepted' ? 'Staged Accepted' : 'Staged Denied';
      
      description += `**Application:** \`${app.applicationId}\`\n`;
      description += `**Applicant:** ${user ? user.toString() : app.discordUsername}\n`;
      description += `**Outcome:** ${outcome}\n`;
      description += `**Reviewer:** ${reviewer ? reviewer.toString() : 'Unknown'}\n\n`;
    }
  }

  if (unreviewedApplications.length > 0) {
    description += '## Unreviewed Applications\n';
    for (const app of unreviewedApplications) {
      const user = await interaction.client.users.fetch(app.discordUserId).catch(() => null);
      
      description += `**Application:** \`${app.applicationId}\`\n`;
      description += `**Applicant:** ${user ? user.toString() : app.discordUsername}\n`;
      description += `**Thread Link:** <#${app.threadId}>\n\n`;
    }
  }

  const embed = {
    author: {
      name: interaction.user.username,
      icon_url: interaction.user.displayAvatarURL({ dynamic: true })
    },
    title: 'Active Applications',
    description: description,
    color: 16730441,
    footer: {
      text: `${Math.min(totalApplications, 20)} out of ${totalApplications} applications`
    }
  };

  const components = [];

  if (stagedApplications.length > 0) {
    components.push({
      type: 1,
      components: [
        {
          style: ButtonStyle.Secondary,
          type: 2,
          label: `Process ${stagedApplications.length} Application(s)`,
          custom_id: `processapps_${interaction.user.id}`
        }
      ]
    });
  }

  await interaction.editReply({
    embeds: [embed],
    components: components,
    flags: MessageFlags.Ephemeral
  });
}

async function handleIdCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await connectDB();

  const applicationId = interaction.options.getString('application_id');
  
  const app = await Application.findOne({ applicationId: applicationId });

  if (!app) {
    return await interaction.editReply({
      content: `No application found with ID: \`${applicationId}\``,
      flags: MessageFlags.Ephemeral
    });
  }

  const user = await interaction.client.users.fetch(app.discordUserId).catch(() => null);
  const reviewer = app.applicationReviewer ? await interaction.client.users.fetch(app.applicationReviewer).catch(() => null) : null;

  const statusMap = {
    'not reviewed': 'Unreviewed',
    'staged accepted': 'Staged Accepted',
    'staged denied': 'Staged Denied',
    'accepted': 'Accepted',
    'denied': 'Denied'
  };

  const robloxProfileUrl = `https://www.roblox.com/users/${app.robloxUserId}/profile`;
  const submittedTimestamp = `<t:${Math.floor(new Date(app.createdAt).getTime() / 1000)}:F>`;
  const reviewedTimestamp = app.dateReviewed ? `<t:${Math.floor(new Date(app.dateReviewed).getTime() / 1000)}:F>` : 'N/A';

  let description = `## <:Logo:1447758148722233425>  Application View (ID)\n-# ID: \`${app.applicationId}\`\n`;
  description += `**Discord User:** ${user ? user.toString() : app.discordUsername}\n`;
  description += `**Roblox User:** [${app.robloxUsername}](${robloxProfileUrl})\n`;
  description += `**Status:** ${statusMap[app.status] || app.status}\n`;
  description += `**Submitted:** ${submittedTimestamp}\n\n`;
  description += `**Application Reviewer:** ${reviewer ? reviewer.toString() : 'N/A'}\n`;
  description += `**Notes:** ${app.applicationNotes || 'N/A'}\n`;
  description += `**Date Reviewed:** ${reviewedTimestamp}\n`;

  const embed = {
    description: description,
    color: 16730441,
    footer: {
      text: `Requested by: ${interaction.user.username}`
    }
  };

  const components = [{
    type: 1,
    components: [{
      type: 2,
      style: 5,
      label: 'Application',
      url: `https://discord.com/channels/${interaction.guildId}/${app.threadId}`
    }]
  }];

  await interaction.editReply({
    embeds: [embed],
    components: components,
    flags: MessageFlags.Ephemeral
  });
}

async function handleUserCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await connectDB();

  const targetUser = interaction.options.getUser('user');
  
  const applications = await Application.find({ discordUserId: targetUser.id }).sort({ createdAt: -1 });

  if (applications.length === 0) {
    return await interaction.editReply({
      content: `No applications found for ${targetUser.toString()}`,
      flags: MessageFlags.Ephemeral
    });
  }

  const blacklistEntry = await Blacklist.findOne({ discordUserId: targetUser.id });
  const isBlacklisted = !!blacklistEntry;
  const blacklistReason = blacklistEntry ? blacklistEntry.reason : 'N/A';

  const firstApp = applications[0];
  const robloxProfileUrl = `https://www.roblox.com/users/${firstApp.robloxUserId}/profile`;
  const avatarUrl = await fetchRobloxAvatar(firstApp.robloxUserId);

  const statusMap = {
    'not reviewed': 'Unreviewed',
    'staged accepted': 'Staged Accepted',
    'staged denied': 'Staged Denied',
    'accepted': 'Accepted',
    'denied': 'Denied'
  };

  let description = `## <:Logo:1447758148722233425>Application View (User)\n\n`;
  description += `**Discord User:** ${targetUser.toString()}\n`;
  description += `**Roblox User:** [${firstApp.robloxUsername}](${robloxProfileUrl})\n`;
  description += `**Blacklisted:** ${isBlacklisted ? 'True' : 'False'}\n`;
  description += `**Blacklist Reason:** ${blacklistReason}\n`;

  const fields = applications.map(app => {
    const submittedTimestamp = `<t:${Math.floor(new Date(app.createdAt).getTime() / 1000)}:F>`;
    const reviewedTimestamp = app.dateReviewed ? `<t:${Math.floor(new Date(app.dateReviewed).getTime() / 1000)}:F>` : 'N/A';
    
    let value = `**Status:** ${statusMap[app.status] || app.status}\n`;
    value += `**Submitted:** ${submittedTimestamp}\n`;
    value += `**Application Reviewer:** ${app.applicationReviewer ? `<@${app.applicationReviewer}>` : 'N/A'}\n`;
    value += `**Notes:** ${app.applicationNotes || 'N/A'}\n`;
    value += `**Date Reviewed:** ${reviewedTimestamp}\n`;
    value += `**Thread Link:** <#${app.threadId}>\n`;

    return {
      name: `Application: \`${app.applicationId}\``,
      value: value
    };
  });

  const embed = {
    description: description,
    color: 16730441,
    footer: {
      text: `Requested by: ${interaction.user.username}`
    },
    fields: fields,
    thumbnail: avatarUrl ? { url: avatarUrl } : undefined
  };

  await interaction.editReply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}