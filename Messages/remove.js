const { PermissionFlagsBits } = require('discord.js');
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
  name: 'remove',
  description: 'Remove a user from the ticket',
  
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

      let userToRemove = message.mentions.users.first();
      
      if (!userToRemove && args[0]) {
        try {
          userToRemove = await message.client.users.fetch(args[0]);
        } catch (error) {
          return message.reply('Invalid user ID provided.');
        }
      }

      if (!userToRemove) {
        return message.reply('Please mention a user or provide a user ID.\nUsage: `-remove @user` or `-remove 123456789`');
      }

      if (userToRemove.id === ticket.userId) {
        return message.reply('You cannot remove the ticket owner.');
      }

      if (userToRemove.id === message.client.user.id) {
        return message.reply('You cannot remove the bot from the ticket.');
      }

      await message.channel.permissionOverwrites.delete(userToRemove.id);

      await message.reply(`Successfully removed ${userToRemove} from the ticket.`);

    } catch (error) {
      console.error('[REMOVE COMMAND] Error:', error);
      message.reply('An error occurred while removing the user from the ticket.');
    }
  }
};