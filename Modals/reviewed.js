const { EmbedBuilder, MessageFlags } = require('discord.js');

const BUG_TAG_ID = '1451067468981342320';
const REVIEWED_TAG_ID = '1451067443354144788';

module.exports = {
  customID: 'reviewed',
  async execute(interaction, args) {
    await interaction.deferUpdate();

    try {
      const customId = interaction.customId;
      const reportId = customId.split('_').slice(1).join('_');
      
      console.log('Custom ID:', customId);
      console.log('Extracted report ID:', reportId);
      
      const estimatedFix = interaction.fields.getTextInputValue('estimated_fix');

      const db = interaction.client.database.conn.db;
      
      const bugReport = await db.collection('bug_reports').findOne({ reportId });

      if (!bugReport) {
        return await interaction.followUp({
          content: 'Bug report not found in database.',
          flags: MessageFlags.Ephemeral
        });
      }

      await db.collection('bug_reports').updateOne(
        { reportId },
        { 
          $set: { 
            status: 'reviewed',
            estimatedFix: estimatedFix,
            reviewedBy: interaction.user.id,
            reviewedAt: new Date()
          } 
        }
      );

      const thread = interaction.channel;
      if (thread.isThread()) {
        const currentTags = thread.appliedTags.filter(tag => tag !== BUG_TAG_ID);
        currentTags.push(REVIEWED_TAG_ID);
        await thread.setAppliedTags(currentTags);
      }

      await thread.send({
        content: `<:Logo:1447758148722233425> **Reviewed by:** <@${interaction.user.id}>\n- Estimated fix: ${estimatedFix}`
      });

      try {
        const user = await interaction.client.users.fetch(bugReport.userId);
        
        const embed = new EmbedBuilder()
          .setDescription("> Your report has been reviewed by our team. Thank you for taking the time to help improve LynxGuard—your feedback plays an important role in keeping the system reliable and effective.")
          .setAuthor({
            name: "Report Reviewed",
            iconURL: "https://cdn.discordapp.com/icons/1446351663622389770/c0f63523dc7609fd8f832e1d762c5237.webp?size=1024",
          })
          .setFields(
            {
              name: "Report Status:",
              value: "<:Restart:1451377598616571944> (Reviewed)",
              inline: true,
            },
            {
              name: "Estimated Fix:",
              value: estimatedFix,
              inline: true,
            }
          )
          .setColor(0x37373D);

        await user.send({ embeds: [embed] });
      } catch (dmError) {
        console.error('Could not DM user:', dmError);
        await thread.send({
          content: `-# Could not DM <@${bugReport.userId}> about the review.`
        });
      }

      await interaction.followUp({
        content: 'Bug report marked as reviewed. User has been notified.',
        flags: MessageFlags.Ephemeral
      });

      const starterMessage = await thread.fetchStarterMessage();
      if (starterMessage) {
        const components = starterMessage.components.map(component => {
          const componentData = component.toJSON();
          
          if (componentData.type === 17) {
            componentData.components = componentData.components.map(comp => {
              if (comp.type === 9 && comp.accessory && comp.accessory.custom_id && comp.accessory.custom_id.startsWith('mark_reviewed_')) {
                comp.accessory.disabled = true;
              }
              return comp;
            });
          }
          
          return componentData;
        });

        await starterMessage.edit({
          components: components,
          flags: MessageFlags.IsComponentsV2
        });
      }

    } catch (error) {
      console.error('Error marking report as reviewed:', error);
      await interaction.followUp({
        content: `An error occurred: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};