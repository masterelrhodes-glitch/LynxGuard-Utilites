const {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  EmbedBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MessageFlags
} = require('discord.js');
const { randomUUID } = require('crypto');

const BUG_FORUM_CHANNEL_ID = '1451067362496479397';
const BUG_TAG_ID = '1451067468981342320';
const SENTRY_ORG = 'lynxgaurd';
const SENTRY_PROJECT = 'node';

module.exports = {
  customID: 'bugs_errors_button',
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('bug_report_modal')
      .setTitle('Report a Bug');

    const errorIdInput = new TextInputBuilder()
      .setCustomId('error_id')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('ERR-A50BE6')
      .setRequired(false);

    const errorIdLabel = new LabelBuilder()
      .setLabel('Error ID')
      .setDescription('If you have an error ID, provide it here')
      .setTextInputComponent(errorIdInput);

    const bugDescriptionInput = new TextInputBuilder()
      .setCustomId('bug_description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Describe the bug or error you encountered...')
      .setRequired(true);

    const bugDescriptionLabel = new LabelBuilder()
      .setLabel('What is the bug/error?')
      .setTextInputComponent(bugDescriptionInput);

    const replicateInput = new TextInputBuilder()
      .setCustomId('replicate_steps')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Steps to replicate the bug...')
      .setRequired(false);

    const replicateLabel = new LabelBuilder()
      .setLabel('How to replicate the bug?')
      .setTextInputComponent(replicateInput);

    const fileUpload = new FileUploadBuilder()
      .setCustomId('bug_files')
      .setMaxValues(4)
      .setRequired(true);

    const fileUploadLabel = new LabelBuilder()
      .setLabel('Upload screenshots/files')
      .setDescription('Attach up to 4 files showing the error')
      .setFileUploadComponent(fileUpload);

    modal
      .addLabelComponents(errorIdLabel)
      .addLabelComponents(bugDescriptionLabel)
      .addLabelComponents(replicateLabel)
      .addLabelComponents(fileUploadLabel);

    await interaction.showModal(modal);
  }
};