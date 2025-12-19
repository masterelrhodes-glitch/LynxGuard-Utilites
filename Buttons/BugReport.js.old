const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
  customID: "bug-report",
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("bug-report-modal")
      .setTitle("Submit a Bug Report");

    const errorid = new TextInputBuilder()
      .setCustomId("errorid")
      .setLabel("Error ID (Optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    const serverurl = new TextInputBuilder()
      .setCustomId("serverurl")
      .setLabel("Server Bug Occurred in (Optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const bugDescription = new TextInputBuilder()
      .setCustomId("bugdescription")
      .setLabel("What is the bug?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const replicatedsteps = new TextInputBuilder()
      .setCustomId("replicatedsteps")
      .setLabel("How can you replicate the bug?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(errorid),
      new ActionRowBuilder().addComponents(serverurl),
      new ActionRowBuilder().addComponents(bugDescription),
      new ActionRowBuilder().addComponents(replicatedsteps)
    );

    await interaction.showModal(modal);
  }
};
