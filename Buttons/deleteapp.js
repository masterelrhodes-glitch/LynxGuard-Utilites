const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  customID: 'deleteapp',
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

      console.log('[DELETE_APP] Delete button clicked by:', interaction.user.id);
      console.log('[DELETE_APP] Target user ID:', targetUserId);

      const modal = new ModalBuilder()
        .setCustomId(`deleteappmodal_${targetUserId}`)
        .setTitle('Delete Application');

      const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for Deletion')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter the reason for deleting this application...')
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1000);

      const actionRow = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('[DELETE_APP] Error showing modal:', error);
      await interaction.reply({
        content: 'An error occurred while processing the delete request.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
};