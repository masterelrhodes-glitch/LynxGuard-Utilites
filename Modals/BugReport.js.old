const { EmbedBuilder } = require("discord.js");

const channelId = "1446693028998942842";
const roleId = "1446352448037064755";

module.exports = {
  customID: "bug-report-modal",
  async execute(interaction) {
    const errorId = interaction.fields.getTextInputValue("errorid");
    const serverurl = interaction.fields.getTextInputValue("serverurl");
    const bugDescription = interaction.fields.getTextInputValue("bugdescription");
    const replicateSteps = interaction.fields.getTextInputValue("replicatedsteps");

    const channel = await interaction.client.channels.fetch(channelId);

    await channel.send({
      content: `<@&${roleId}>`,
      embeds: [
        new EmbedBuilder()
          .setTitle("<:Logo:1447758148722233425> LynxGuard Bug Report")
          .setColor(16733302)
          .setDescription(
            `A new bug report has been submitted, refer below for details.\n\n\**Referenced Error ID:** ${errorId || "Not Provided"}\n**Referenced Server Invite:** ${serverurl || "Not Provided"}\n**Bug Information:** ${bugDescription}\n **Steps to Replicate:** ${replicateSteps}`)
          .setFooter({
            text: `Submitted By: ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL()
          })
      ]
    });

    await interaction.reply({
      content: "Bug report submitted successfully.",
      ephemeral: true
    });
  }
};
