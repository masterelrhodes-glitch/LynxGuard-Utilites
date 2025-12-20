const { EmbedBuilder, MessageFlags } = require('discord.js');

const BUG_TAG_ID = '1451067468981342320';
const RESOLVED_TAG_ID = '1451067488849629355';

module.exports = {
  customID: 'close',
  async execute(interaction) {
    await interaction.deferUpdate();

    try {
      const customId = interaction.customId;
      const reportId = customId.split('_').slice(2).join('_');
      
      const fixNeeded = interaction.fields.getStringSelectValues('fix_needed')[0];
      const possibleReason = interaction.fields.getTextInputValue('possible_reason') || null;

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
            status: 'handled',
            fixNeeded: fixNeeded === 'yes',
            closeReason: possibleReason,
            closedBy: interaction.user.id,
            closedAt: new Date()
          } 
        }
      );

      const thread = interaction.channel;
      if (thread.isThread()) {
        const currentTags = thread.appliedTags.filter(tag => tag !== BUG_TAG_ID);
        currentTags.push(RESOLVED_TAG_ID);
        await thread.setAppliedTags(currentTags);
        
        await thread.setLocked(true);
        await thread.setArchived(true);
      }

      const fixNeededText = fixNeeded === 'yes' ? '**Yes**' : '**No**';
      const reasonText = fixNeeded === 'no' && possibleReason ? `\n- Reason: ${possibleReason}` : '';

      await thread.send({
        content: `## <:Logo:1447758148722233425> Report Closed\n<@${interaction.user.id}> has closed this report.\n- Was a fix needed: ${fixNeededText}${reasonText}`
      });

      try {
        const user = await interaction.client.users.fetch(bugReport.userId);
        const createdDate = new Date(bugReport.createdAt);
        const formattedDate = `<t:${Math.floor(createdDate.getTime() / 1000)}:D>`;
        
        let embed;
        
        if (fixNeeded === 'yes') {
          embed = new EmbedBuilder()
            .setDescription(`<:Logo:1447758148722233425> The reported issue has been resolved. Thank you for bringing this to our attention—your report helped improve LynxGuard's stability and performance.\n\n-# Report ID: ${reportId}`)
            .setFields(
              {
                name: 'Reported:',
                value: formattedDate,
                inline: true,
              },
              {
                name: 'Status:',
                value: '<:Restart:1451377598616571944> Resolved',
                inline: true,
              },
              {
                name: '',
                value: '',
                inline: true,
              }
            )
            .setColor(0x37373D);
        } else {
          const reasonDisplay = possibleReason ? possibleReason : 'Not specified';
          embed = new EmbedBuilder()
            .setDescription(`<:Logo:1447758148722233425> After review, no fix was required for this report. Thank you for taking the time to reach out and help us verify LynxGuard's functionality.\n\n- **Reason:** ${reasonDisplay}\n-# Report ID: ${reportId}`)
            .setColor(0x37373D);
        }

        await user.send({ embeds: [embed] });
      } catch (dmError) {
        console.error('Could not DM user:', dmError);
        await thread.send({
          content: `-# Could not DM <@${bugReport.userId}> about the closure.`
        });
      }

      await interaction.followUp({
        content: 'Bug report closed successfully. User has been notified.',
        flags: MessageFlags.Ephemeral
      });

      const starterMessage = await thread.fetchStarterMessage();
      if (starterMessage) {
        const components = starterMessage.components.map(component => {
          const componentData = component.toJSON();
          
          if (componentData.type === 17) {
            componentData.components = componentData.components.map(comp => {
              if (comp.type === 9 && comp.accessory && comp.accessory.custom_id) {
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
      console.error('Error closing report:', error);
      await interaction.followUp({
        content: `An error occurred: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};