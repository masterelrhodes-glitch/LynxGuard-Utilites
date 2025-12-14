const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

const GUILD_ID = '1446351663622389770';
const RESOLVED_TAG_ID = '1449647407859109940';
const REPO_CHANNEL_ID = '1448109227150282812';

module.exports = {
  customID: 'resolved',
  
  async execute(interaction, client, args) {
    try {
      const modal = args[0];
      const errorId = args[1];
      const commitHash = interaction.fields.getTextInputValue('commit_hash').trim().toLowerCase();

      await interaction.deferUpdate();

      const guild = await client.guilds.fetch(GUILD_ID);
      const repoChannel = await guild.channels.fetch(REPO_CHANNEL_ID);
      
      const messages = await repoChannel.messages.fetch({ limit: 100 });
      const commitMessage = messages.find(msg => {
        if (msg.embeds.length === 0) return false;
        
        const embed = msg.embeds[0];
        const description = embed.description?.toLowerCase() || '';
        const title = embed.title?.toLowerCase() || '';
        const fields = embed.fields?.map(f => f.value.toLowerCase()).join(' ') || '';
        
        return description.includes(commitHash) || 
               title.includes(commitHash) || 
               fields.includes(commitHash);
      });

      if (!commitMessage) {
        await interaction.followUp({
          content: `Could not find a commit with hash \`${commitHash}\` in <#${REPO_CHANNEL_ID}>.\n\nPlease verify the commit hash and try again.`,
          ephemeral: true
        });
        return;
      }

      const thread = interaction.channel;
      
      const currentName = thread.name;
      const newName = `[RESOLVED] ${currentName.replace('[REVIEWED] ', '')}`;
      await thread.setName(newName);
      
      await thread.setAppliedTags([RESOLVED_TAG_ID]);
      
      const resolveEmbed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('Error Resolved')
        .setDescription('This error has been fixed and resolved.')
        .addFields(
          { name: 'Resolved by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Commit', value: `[${commitHash}](${commitMessage.url})`, inline: true }
        )
        .setTimestamp();

      await thread.send({
        embeds: [resolveEmbed]
      });

      setTimeout(async () => {
        try {
          await thread.setLocked(true);
          await thread.setArchived(true);
        } catch (lockError) {
          console.error('Error locking thread:', lockError);
        }
      }, 3000);

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

      client.logs.success(`Error ${errorId} resolved by ${interaction.user.tag} with commit ${commitHash}`);
      
    } catch (error) {
      console.error('Error in resolved modal:', error);
      
      try {
        if (interaction.deferred) {
          await interaction.followUp({
            content: 'An error occurred while marking this as resolved.',
            ephemeral: true
          });
        } else if (!interaction.replied) {
          await interaction.reply({
            content: 'An error occurred while marking this as resolved.',
            ephemeral: true
          });
        }
      } catch (followUpError) {
        console.error('Error sending error message:', followUpError);
      }
    }
  }
};