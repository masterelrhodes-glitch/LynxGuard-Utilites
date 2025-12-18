const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const channelId = "1446693028998942842";

module.exports = {
  name: "bugreport",
  description: "Sends the bug report embed",
  devGuild: true,

  async execute(message) {
    const channel = await message.client.channels.fetch(channelId);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("<:Logo:1447758148722233425> LynxGuard Bug Report")
          .setDescription("Here you can report bugs that you encounter while using LynxGuard. Please make sure the information you provide is accurate, if you are unsure about any information, try your best to fill it out.")
          .setColor("#ff5476")
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("bug-report")
            .setLabel("Submit Bug Report")
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
    await message.delete();
  }
};
