const { 
  SlashCommandBuilder, 
  ChannelType,
  ContainerBuilder,
  MediaGalleryBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits
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

const Embed = mongoose.models.Embed || mongoose.model('Embed', embedSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embeds')
    .setDescription('Send pre-configured embeds')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Select the embed type')
        .setRequired(true)
        .addChoices(
          { name: 'Information', value: 'information' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the embed to (defaults to current channel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      const embedType = interaction.options.getString('type');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
      if (!permissions.has(PermissionFlagsBits.SendMessages)) {
        return await interaction.reply({
          content: 'I don\'t have permission to send messages in that channel.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      await connectDB();

      // Delete all old entries of this embed type in this guild
      const deleteResult = await Embed.deleteMany({
        guildId: interaction.guildId,
        embedType: embedType
      });

      console.log(`[EMBEDS] Deleted ${deleteResult.deletedCount} old ${embedType} embed entries`);

      let sentMessage;

      if (embedType === 'information') {
        sentMessage = await sendInformationEmbed(targetChannel);
      }
      
      // Create new entry for the newly sent embed
      await Embed.create({
        messageId: sentMessage.id,
        channelId: targetChannel.id,
        guildId: interaction.guildId,
        embedType: embedType,
        createdBy: interaction.user.id
      });

      console.log(`[EMBEDS] Created new ${embedType} embed entry for message ${sentMessage.id}`);

      await interaction.editReply({
        content: `Successfully sent the ${embedType} embed to ${targetChannel}!\nMessage ID: \`${sentMessage.id}\`${deleteResult.deletedCount > 0 ? `\n*Deleted ${deleteResult.deletedCount} old ${embedType} embed(s)*` : ''}`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('Error executing embeds command:', error);
      
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

async function sendInformationEmbed(channel) {
  const mediaGallery = new MediaGalleryBuilder().addItems(
    (item) =>
      item
        .setDescription('LynxGuard Banner')
        .setURL('https://cdn.discordapp.com/banners/1444878574984237066/ee95693357d252e0dff2e9393e627046.webp?size=1024')
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x37373D)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        '<:Logo:1447758148722233425>   **LynxGuard** is an AI-powered moderation system built for ERLC servers that assists staff, enforces rules, and keeps roleplay environments running smoothly. Through API integrations and trained AI systems, it analyzes player behavior to identify patterns commonly associated with rule violations, helping moderators make faster, more consistent decisions without replacing human oversight.'
      )
    )
    .addSeparatorComponents((separator) =>
      separator.setSpacing(SeparatorSpacingSize.Large)
    )
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            'LynxGuard is backed by a dedicated 24/7 development and support team committed to maintaining stability, rolling out improvements, and assisting server staff whenever needed. Our team ensures continuous updates, rapid issue resolution, and reliable support to keep your ERLC server running without interruption.'
          )
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId('assistance_button')
            .setLabel('Assistance')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        )
    )
    .addSeparatorComponents((separator) =>
      separator
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Large)
    )
    .addSectionComponents((section) =>
      section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            'Bugs can be reported at any time through our report system,\n allowing our development team to quickly review, track,\n and resolve issues to maintain system stability and performance.\n\n'
          )
        )
        .setButtonAccessory((button) =>
          button
            .setCustomId('bugs_errors_button')
            .setLabel('Bugs & Errors')
            .setStyle(ButtonStyle.Danger)
        )
    )
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent('-# Ⓒ LynxGuard 2025')
    );

  const containerData = container.toJSON();
  const mediaGalleryData = mediaGallery.toJSON();
  
  containerData.components.unshift(mediaGalleryData);

  const message = await channel.send({
    components: [
      containerData,
      {
        type: 1,
        components: [
          {
            type: 2,
            style: ButtonStyle.Secondary,
            label: 'Application',
            custom_id: 'apply_button'
          },
          {
            type: 2,
            style: ButtonStyle.Link,
            label: 'Website',
            url: 'https://lynxguard.xyz'
          }
        ]
      }
    ],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications
  });

  return message;
}