const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customID: 'stageapp',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const targetUserId = args && args[0] ? args[0] : null;
      
      if (!targetUserId) {
        return await interaction.reply({
          content: 'Invalid application target.',
          flags: MessageFlags.Ephemeral
        });
      }

      const selectedValue = interaction.values[0];

      console.log('[STAGE_APP] Menu selected by:', interaction.user.id);
      console.log('[STAGE_APP] Target user ID:', targetUserId);
      console.log('[STAGE_APP] Selected action:', selectedValue);

      if (selectedValue === 'blacklist') {
        const modal = new ModalBuilder()
          .setCustomId(`blacklistmodal_${targetUserId}`)
          .setTitle('Blacklist User');

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for Blacklist')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter the reason for blacklisting this user...')
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1000);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
      } else {
        const modal = new ModalBuilder()
          .setCustomId(`stageappmodal_${targetUserId}_${selectedValue}`)
          .setTitle(`Stage Application - ${selectedValue === 'accept' ? 'Accept' : 'Deny'}`);

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason (Optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Enter a reason for this decision (optional)...')
          .setRequired(false)
          .setMaxLength(1000);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
      }

    } catch (error) {
      console.error('[STAGE_APP] Error showing modal:', error);
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};