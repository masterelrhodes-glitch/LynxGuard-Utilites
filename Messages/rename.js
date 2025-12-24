const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  ticketId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  ticketType: { type: String, required: true },
  reason: { type: String, required: true },
  dateMade: { type: Date, default: Date.now },
  dateClosed: { type: Date, default: null },
  closedBy: { type: String, default: null },
  closureReason: { type: String, default: null },
  transcriptLink: { type: String, default: null }
});

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

const SUPPORT_ROLES = [
  '1448100092358823966',
  '1448906996421099561',
  '1448097004470145095',
  '1448096870508400640',
  '1448098877327806638'
];

async function connectMainDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

module.exports = {
  name: 'rename',
  description: 'Rename the ticket channel',
  
  async execute(message, client, args) {
    try {
      if (!message.member) {
        return message.reply('Unable to verify your permissions.');
      }

      const hasRole = message.member.roles.cache.some(role => 
        SUPPORT_ROLES.includes(role.id)
      );

      if (!hasRole) {
        return message.reply('You do not have permission to use this command.');
      }

      await connectMainDB();
      const ticket = await Ticket.findOne({ channelId: message.channel.id });

      if (!ticket) {
        return message.reply('This command can only be used in ticket channels.');
      }

      if (!args[0]) {
        return message.reply('Please provide a new name for the ticket.\nUsage: `-rename <new-name>`');
      }

      const ticketPrefixes = {
        'billing': 'bill',
        'general': 'gen',
        'developer': 'dev'
      };

      const prefix = ticketPrefixes[ticket.ticketType] || 'ticket';
      
      const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      
      if (!newName) {
        return message.reply('Invalid ticket name. Please use only letters, numbers, and hyphens.');
      }

      const fullChannelName = `${prefix}-${newName}`;

      await message.channel.setName(fullChannelName);

      await message.reply(`Successfully renamed ticket to **${fullChannelName}**`);

    } catch (error) {
      console.error('[RENAME COMMAND] Error:', error);
      message.reply('An error occurred while renaming the ticket.');
    }
  }
};