const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

const UNRESOLVED_TAG_ID = '1449647367866552330';
const REVIEWED_TAG_ID = '1449647392063357083';

module.exports = {
  customId: (id) => id.startsWith('review_modal_'),
  
  async execute(interaction) {
    try {
      const errorId = interaction.customId.replace('review_modal_', '');
      const reason = interaction.fields.getTextInputValue('review_reason');

      await interaction.deferUpdate();

      const thread = interaction.channel;
      
      const currentName = thread.name;
      const newName = currentName.startsWith('Error') 
        ? `[REVIEWED] ${currentName}` 
        : currentName;
      
      await thread.setName(newName);

      const currentTags = thread.appliedTags.filter(tag => tag !== UNRESOLVED_TAG_ID);
      if (!currentTags.includes(REVIEWED_TAG_ID)) {
        currentTags.push(REVIEWED_TAG_ID);
      }
      await thread.setAppliedTags(currentTags);

      const reviewEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('Error Reviewed')
        .setDescription(reason)
        .setFooter({ text: `Reviewed by ${interaction.user.tag}` })
        .setTimestamp();

      await thread.send({
        embeds: [reviewEmbed]
      });

      const updatedSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`error_action_${errorId}`)
        .setPlaceholder('Error has been reviewed')
        .addOptions([
          {
            label: 'Review',
            value: 'review',
            description: 'Already reviewed'
          },
          {
            label: 'Resolved',
            value: 'resolved',
            description: 'Mark this error as resolved'
          }
        ]);

      const updatedRow = new ActionRowBuilder().addComponents(updatedSelectMenu);

      await interaction.message.edit({
        components: [updatedRow]
      });

      interaction.client.logs.success(`Error ${errorId} reviewed by ${interaction.user.tag}`);
      
    } catch (error) {
      console.error('Error in review modal:', error);
      
      try {
        if (interaction.deferred) {
          await interaction.followUp({
            content: 'An error occurred while processing your review.',
            ephemeral: true
          });
        } else if (!interaction.replied) {
          await interaction.reply({
            content: 'An error occurred while processing your review.',
            ephemeral: true
          });
        }
      } catch (followUpError) {
        console.error('Error sending error message:', followUpError);
      }
    }
  }
};