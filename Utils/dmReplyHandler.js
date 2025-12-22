const { ChannelType } = require('discord.js');

async function handleDMReply(message, client) {
  console.log('[DM_REPLY] Checking message...');
  console.log('[DM_REPLY] Is bot?', message.author.bot);
  console.log('[DM_REPLY] Channel type:', message.channel.type);
  
  if (message.author.bot) return false;
  if (message.channel.type !== ChannelType.DM) return false;

  const modalHandler = require('../Modals/dmusermodal.js');
  const pendingReplies = modalHandler.pendingReplies;
  const userLastDM = modalHandler.userLastDM;
  
  let replyInfo = null;

  if (message.reference) {
    console.log('[DM_REPLY] Has reference, checking...');
    replyInfo = pendingReplies.get(message.reference.messageId);
  }

  if (!replyInfo) {
    console.log('[DM_REPLY] No reference match, checking userLastDM...');
    replyInfo = userLastDM.get(message.author.id);
  }
  
  console.log('[DM_REPLY] Reply info found?', !!replyInfo);
  
  if (!replyInfo) return false;
  if (replyInfo.userId !== message.author.id) return false;

  try {
    console.log('[DM_REPLY] Processing reply...');
    const thread = await client.channels.fetch(replyInfo.threadId).catch(() => null);
    
    if (!thread) {
      await message.reply('Could not send your reply - the application thread was not found.');
      if (message.reference) pendingReplies.delete(message.reference.messageId);
      userLastDM.delete(message.author.id);
      return true;
    }

    await thread.send({
      content: `## <:Discord:1451072525454016674> Applicant Reply\n-# From: <@${message.author.id}> | Application ID: \`${replyInfo.applicationId}\`\n-# In response to message from: <@${replyInfo.adminId}>\n\n"${message.content}"`
    });

    await message.reply('Your reply has been sent to the application review team.');

    if (message.reference) pendingReplies.delete(message.reference.messageId);
    userLastDM.delete(message.author.id);

    console.log(`[DM_REPLY] User ${message.author.username} replied to application ${replyInfo.applicationId}`);

    return true;
  } catch (error) {
    console.error('[DM_REPLY] Error handling reply:', error);
    await message.reply('An error occurred while sending your reply. Please contact an administrator.').catch(() => {});
    return true;
  }
}

module.exports = { handleDMReply };