const { handleApplicationMessage } = require('../Utils/applicationMessageHandler');

module.exports = {
  name: 'messageCreate',
  async execute(client, message) {
    await handleApplicationMessage(message);

  }
};