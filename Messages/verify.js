const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const channelId = '1446693028998942842';
const requiredRoleId = '1446352448037064755';

module.exports = {
  name: 'verify',
  description: 'Sends the verification embed',
  async execute(message, client, args) {

    if (!message.member.roles.cache.has(requiredRoleId)) {
      return message.reply({ content: 'You do not have permission to run this command.', ephemeral: true });
    }

    const channel = await message.client.channels.fetch(channelId);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('Lynxguard Verification')
          .setDescription('Verifying is a crucial step in accessing the entire server. Ensure you verify by pressing the button below and following the instructions.')
          .setColor('#2b2d31')
          .setThumbnail(message.guild.iconURL())
          .setFooter({ text: 'LynxGuard' })
          .setTimestamp()
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('verify:button')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });

    await message.delete();
  }
}
