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
        .setDescription('LynxGuard Information Banner')
        .setURL('https://cdn.discordapp.com/attachments/1446353354468098140/1454190733849399448/Information_Banner.png?ex=69503028&is=694edea8&hm=b4440b6cc44aac0de1612d33c24578fc1214f2c7cb3873ab7c525c05fdca0cd9&animated=true')
  );

  const container = new ContainerBuilder()
    .setAccentColor(0x37373D)
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent('## System Overview')
    )
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent(
        'LynxGuard is an AI-powered moderation system that operates around-the-clock to assist staff in effectively enforcing rules across Emergency Response: Liberty County (ERLC) servers. While tracking player behavior in real time to give moderators clear, useful insights, it automatically identifies common infractions like Random Deathmatch, New Life Rule violations, and unrealistic avatars. This lessens the workload for employees, speeds up response times, and supports the upkeep of equitable, well-organized roleplay environments. This is the official LynxGuard Community server for important announcements, system alerts, and product updates.'
      )
    )
    .addSeparatorComponents((separator) =>
      separator
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Large)
    )
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent('## Server Guide')
    )
    .addSectionComponents((section) => {
      const assistanceButton = new (require('discord.js').ButtonBuilder)()
        .setCustomId('assistance_button')
        .setLabel('Assistance')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('1451073001792737300');
      
      return section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            '**Require Assistance?** If you need assistance, please click the button to the right to contact our support team. A team member will respond as soon as possible.'
          )
        )
        .setButtonAccessory(assistanceButton);
    })
    .addSectionComponents((section) => {
      const bugsButton = new (require('discord.js').ButtonBuilder)()
        .setCustomId('bugs_errors_button')
        .setLabel('Bugs')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('1451072866786476032');
      
      return section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            '**Bugs you noticed?** If you\'ve encountered a bug, please click the button to the right and complete the report form. Our team will review the issue and address the rest.'
          )
        )
        .setButtonAccessory(bugsButton);
    })
    .addSectionComponents((section) => {
      const applicationButton = new (require('discord.js').ButtonBuilder)()
        .setCustomId('apply_button')
        .setLabel('Application')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('1451072968548684028');
      
      return section
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            '**Looking to apply for the support team?** Click the button to the right to submit your application.'
          )
        )
        .setButtonAccessory(applicationButton);
    })
    .addTextDisplayComponents((textDisplay) =>
      textDisplay.setContent('☀️ *Moderation, Powered by Intelligence.*')
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
            style: ButtonStyle.Link,
            label: 'Website',
            url: 'https://www.lynxguard.xyz/'
          },
          {
            type: 2,
            style: ButtonStyle.Link,
            label: 'Privacy Policy',
            url: 'https://www.lynxguard.xyz/privacy'
          },
          {
            type: 2,
            style: ButtonStyle.Link,
            label: 'Terms of Service',
            url: 'https://www.lynxguard.xyz/terms'
          },
          {
            type: 2,
            style: ButtonStyle.Link,
            label: 'FAQ',
            url: 'https://www.lynxguard.xyz/faq'
          }
        ]
      }
    ],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications
  });

  return message;
}