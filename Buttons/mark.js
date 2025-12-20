const { ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
  customID: 'mark',
  async execute(interaction) {
    const customId = interaction.customId;
    const reportId = customId.split('_').slice(2).join('_');
    
    console.log('Button customId:', customId);
    console.log('Extracted reportId:', reportId);

    const modal = new ModalBuilder()
      .setCustomId(`reviewed_${reportId}`)
      .setTitle('Mark Report as Reviewed');

    const estimatedFixLabel = new LabelBuilder()
      .setLabel('Estimated Fix Time')
      .setDescription('How long until this bug is expected to be fixed?')
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('estimated_fix')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., 24 Hours, 2-3 Days, 1 Week')
          .setRequired(true)
      );

    modal.addLabelComponents(estimatedFixLabel);
    
    console.log('Modal customId being set:', `reviewed_${reportId}`);
    await interaction.showModal(modal);
  }
};