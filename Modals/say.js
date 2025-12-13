const { MessageFlags } = require("discord.js");

module.exports = {
  customID: "say",
  async execute(interaction, client) {
    const message = interaction.fields.getTextInputValue("message");
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await interaction.channel.send(message);
      await interaction.deleteReply();
    } catch (error) {
      await interaction.editReply(
        "Failed to send message - Check I have permission to send messages in this channel!"
      );
    }
  },
};
