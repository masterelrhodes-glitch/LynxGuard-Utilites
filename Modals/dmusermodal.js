const { MessageFlags } = require('discord.js');

const pendingReplies = new Map();
const userLastDM = new Map();

module.exports = {
  customID: 'dmusermodal',
  skipSplit: false,
  async execute(interaction, client, args) {
    try {
      const targetUserId = args && args[0] ? args[0] : null;
      const applicationId = args && args[1] ? args[1] : null;
      const threadId = args && args[2] ? args[2] : null;

      if (!targetUserId || !applicationId || !threadId) {
        return await interaction.reply({
          content: 'Missing required information.',
          flags: MessageFlags.Ephemeral
        });
      }

      const message = interaction.fields.getTextInputValue('message');

      const targetUser = await client.users.fetch(targetUserId).catch(() => null);
      
      if (!targetUser) {
        return await interaction.reply({
          content: 'Could not find the user.',
          flags: MessageFlags.Ephemeral
        });
      }

      const dmMessage = await targetUser.send(
        `## <:message:1451073020906180750> Reply From Server Admins\n-# Direct reply to application ID: \`${applicationId}\`\n\n"${message}"\n\n*Respond to this message and your reply will be recorded.*`
      ).catch(() => null);

      if (!dmMessage) {
        return await interaction.reply({
          content: 'Could not send DM to the user. They may have DMs disabled.',
          flags: MessageFlags.Ephemeral
        });
      }

      const replyInfo = {
        userId: targetUserId,
        threadId: threadId,
        applicationId: applicationId,
        adminId: interaction.user.id,
        adminUsername: interaction.user.username,
        timestamp: Date.now()
      };

      pendingReplies.set(dmMessage.id, replyInfo);
      userLastDM.set(targetUserId, replyInfo);

      setTimeout(() => {
        pendingReplies.delete(dmMessage.id);
        userLastDM.delete(targetUserId);
      }, 24 * 60 * 60 * 1000);

      await interaction.reply({
        content: `Message sent to <@${targetUserId}>`,
        flags: MessageFlags.Ephemeral
      });

    } catch (error) {
      console.error('[DM_USER_MODAL] Error:', error);
      await interaction.reply({
        content: 'An error occurred while sending the message.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  },
  pendingReplies,
  userLastDM
};