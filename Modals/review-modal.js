const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

const UNRESOLVED_TAG_ID = '1449647367866552330';
const REVIEWED_TAG_ID = '1449647392063357083';

module.exports = {
  customID: 'review',
  
  async execute(interaction, client, args) {
    try {
      const modal = args[0];
      const errorId = args[1];
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

      await thread.send({
        content: `**Error Reviewed by <@${interaction.user.id}>**\n- ${reason}\n-# <@${interaction.user.id}> Marked the error ready to be resolved`
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

      client.logs.success(`Error ${errorId} reviewed by ${interaction.user.tag}`);
      
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