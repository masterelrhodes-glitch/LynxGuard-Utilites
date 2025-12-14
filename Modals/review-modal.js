const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

const UNRESOLVED_TAG_ID = '1449647367866552330';
const REVIEWED_TAG_ID = '1449647392063357083';

module.exports = {
  customId: (id) => id.startsWith('review_modal_'),
  
  async execute(interaction) {
    const errorId = interaction.customId.replace('review_modal_', '');
    const reason = interaction.fields.getTextInputValue('review_reason');

    await interaction.deferUpdate();

    const thread = interaction.channel;
    await thread.setName(`${interaction.user.username} Reviewed ${errorId}`);

    const currentTags = thread.appliedTags.filter(tag => tag !== UNRESOLVED_TAG_ID);
    currentTags.push(REVIEWED_TAG_ID);
    await thread.setAppliedTags(currentTags);

    await interaction.followUp({
      content: `**Review by <@${interaction.user.id}>:**\n${reason}`,
      allowedMentions: { parse: [] }
    });

    const updatedSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`error_action_${errorId}`)
      .setPlaceholder('Select an action')
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

    updatedSelectMenu.options[0].default = true;

    const updatedRow = new ActionRowBuilder().addComponents(updatedSelectMenu);

    await interaction.message.edit({
      components: [updatedRow]
    });
  }
};