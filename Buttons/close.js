const { ModalBuilder, LabelBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
  customID: 'close',
  async execute(interaction) {
    const customId = interaction.customId;
    const reportId = customId.split('_').slice(2).join('_');

    const modal = new ModalBuilder()
      .setCustomId(`close_modal_${reportId}`)
      .setTitle('Close Bug Report');

    const fixNeededSelect = new StringSelectMenuBuilder()
      .setCustomId('fix_needed')
      .setPlaceholder('Select an option')
      .setRequired(true)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Yes')
          .setDescription('A fix was needed and implemented')
          .setValue('yes'),
        new StringSelectMenuOptionBuilder()
          .setLabel('No')
          .setDescription('No fix was needed')
          .setValue('no')
      );

    const fixNeededLabel = new LabelBuilder()
      .setLabel('Was a fix needed?')
      .setDescription('Select whether this issue required a fix')
      .setStringSelectMenuComponent(fixNeededSelect);

    const reasonInput = new TextInputBuilder()
      .setCustomId('possible_reason')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Explain why no fix was needed...')
      .setRequired(false);

    const reasonLabel = new LabelBuilder()
      .setLabel('Possible reason (if No)')
      .setDescription('Optional: Explain why no fix was needed')
      .setTextInputComponent(reasonInput);

    modal
      .addLabelComponents(fixNeededLabel)
      .addLabelComponents(reasonLabel);

    await interaction.showModal(modal);
  }
};