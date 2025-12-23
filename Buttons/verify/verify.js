const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  customID: 'verify:button',
  async execute(interaction, args, client) {
    await interaction.reply({
      content: "To start verification, press the **Verify** button below. Once you’ve completed the verification steps, press the **Done** button to finish.\n-# If you encounter any issues verifying please reach out to us [here](<https://lynxguard.xyz/discord>).",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Verify')
            .setStyle(ButtonStyle.Link)
            .setURL('https://verify.lynxguard.xyz/'),
          new ButtonBuilder()
            .setCustomId('verifyDone:button')
            .setLabel('Done')
            .setStyle(ButtonStyle.Secondary)
        )
      ],
      ephemeral: true
    });
  }
};
