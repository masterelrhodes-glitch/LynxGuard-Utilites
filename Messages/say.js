const ADMIN_ROLE_ID = '1446352448037064755';

module.exports = {
  name: 'say',
  description: 'Send a message as the bot',
  async execute(message, args) {
    if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
      return await message.reply({
        content: 'You do not have permission to use this command.',
        flags: 64
      });
    }

    const content = message.content.slice(message.content.indexOf(' ') + 1).trim();

    if (!content || content === message.content) {
      return await message.reply({
        content: 'Please provide a message to send.',
        flags: 64
      });
    }

    try {
      await message.channel.send(content);
      await message.delete().catch(() => {});
    } catch (error) {
      console.error('[SAY] Error:', error);
      await message.reply({
        content: 'Failed to send message.',
        flags: 64
      });
    }
  }
};