const { handleApplicationMessage } = require('../Utils/applicationMessageHandler');
const { handleDMReply } = require('../Utils/dmReplyHandler');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    const wasHandled = await handleDMReply(message, client);
    if (wasHandled) return;

    await handleApplicationMessage(message);
  }
};