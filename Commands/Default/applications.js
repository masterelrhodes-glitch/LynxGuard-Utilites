const { 
  SlashCommandBuilder, 
  MessageFlags,
  PermissionFlagsBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} = require('discord.js');
const mongoose = require('mongoose');

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

const Embed = mongoose.models.Embed || mongoose.model('Embed', embedSchema);
const Application = mongoose.models.Application || mongoose.model('Application', applicationSchema);

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'status') {
        await handleStatusCommand(interaction);
      } else if (subcommand === 'manage') {
        await handleManageCommand(interaction);
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

  let description = '';

  if (stagedApplications.length > 0) {
    description += '## Staged Applications\n';
    for (const app of stagedApplications) {
      const user = await interaction.client.users.fetch(app.discordUserId).catch(() => null);
      const reviewer = app.applicationReviewer ? await interaction.client.users.fetch(app.applicationReviewer).catch(() => null) : null;
      const outcome = app.status === 'staged accepted' ? 'Accepted ' : 'Denied ';
      
      description += `**Application:** ${app.applicationId}\n`;
      description += `**Applicant:** ${user ? user.toString() : app.discordUsername}\n`;
      description += `**Outcome:** ${outcome}\n`;
      description += `**Reviewer:** ${reviewer ? reviewer.toString() : 'Unknown'}\n\n`;
    }
  }

  if (unreviewedApplications.length > 0) {
    description += '## <:file:1451072954426458132> Unreviewed Applications\n';
    for (const app of unreviewedApplications) {
      const user = await interaction.client.users.fetch(app.discordUserId).catch(() => null);
      
      description += `**Application:** ${app.applicationId}\n`;
      description += `**Applicant:** ${user ? user.toString() : app.discordUsername}\n`;
      description += `**Thread Link:** <#${app.threadId}>\n\n`;
    }
  }

  const embed = {
    author: {
      name: interaction.user.username,
      icon_url: interaction.user.displayAvatarURL({ dynamic: true })
    },
    title: '<:support_notify:1451073086651633756> Active Applications',
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