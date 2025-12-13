const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');

const ADMIN_ROLE_ID = '1446352448037064755';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send an embed message')
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to send the embed to')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return await interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: 64
      });
    }

    const channel = interaction.options.getChannel('channel');
    
    const modal = new ModalBuilder()
      .setCustomId(`embed_send_${channel?.id || 'current'}`)
      .setTitle('Send Embed');

    const contentInput = new TextInputBuilder()
      .setCustomId('embed_content')
      .setLabel('Message Contents (JSON Text)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter your embed JSON here...')
      .setRequired(true);

    const contentRow = new ActionRowBuilder().addComponents(contentInput);

    modal.addComponents(contentRow);

    await interaction.showModal(modal);
  }
};