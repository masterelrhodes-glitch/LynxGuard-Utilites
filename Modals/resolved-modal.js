const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

const GUILD_ID = '1446351663622389770';
const RESOLVED_TAG_ID = '1449647407859109940';
const REPO_CHANNEL_ID = '1448109227150282812';

module.exports = {
  customId: (id) => id.startsWith('resolved_modal_'),
  
  async execute(interaction) {
    const errorId = interaction.customId.replace('resolved_modal_', '');
    const commitHash = interaction.fields.getTextInputValue('commit_hash');

    await interaction.deferUpdate();

    const guild = await interaction.client.guilds.fetch(GUILD_ID);
    const repoChannel = await guild.channels.fetch(REPO_CHANNEL_ID);
    
    const messages = await repoChannel.messages.fetch({ limit: 100 });
    const commitMessage = messages.find(msg => 
      msg.embeds.length > 0 && 
      msg.embeds[0].description && 
      msg.embeds[0].description.includes(commitHash)
    );

    if (!commitMessage) {
      await interaction.followUp({
        content: 'Could not find a commit with that hash in the repository channel.',
        ephemeral: true
      });
      return;
    }

    const thread = interaction.channel;
    await thread.setName(`Resolved ${errorId}`);
    await thread.setAppliedTags([RESOLVED_TAG_ID]);
    await thread.setLocked(true);

    await interaction.followUp({
      content: `**Resolved by <@${interaction.user.id}>**\nCommit: ${commitMessage.url}`,
      allowedMentions: { parse: [] }
    });

    const disabledSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`error_action_${errorId}`)
      .setPlaceholder('Resolved')
      .addOptions([
        {
          label: 'Resolved',
          value: 'resolved',
          description: 'This error has been resolved'
        }
      ])
      .setDisabled(true);

    const disabledRow = new ActionRowBuilder().addComponents(disabledSelectMenu);

    await interaction.message.edit({
      components: [disabledRow]
    });
  }
};