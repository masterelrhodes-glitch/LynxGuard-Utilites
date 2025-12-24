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
  name: 'add',
  description: 'Add a user to the ticket',
  
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

      let userToAdd = message.mentions.users.first();
      
      if (!userToAdd && args[0]) {
        try {
          userToAdd = await message.client.users.fetch(args[0]);
        } catch (error) {
          return message.reply('Invalid user ID provided.');
        }
      }

      if (!userToAdd) {
        return message.reply('Please mention a user or provide a user ID.\nUsage: `-add @user` or `-add 123456789`');
      }

      if (userToAdd.id === ticket.userId) {
        return message.reply('This user is already the ticket owner.');
      }

      await message.channel.permissionOverwrites.edit(userToAdd.id, {
        [PermissionFlagsBits.ViewChannel]: true,
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.ReadMessageHistory]: true,
        [PermissionFlagsBits.AttachFiles]: true,
        [PermissionFlagsBits.EmbedLinks]: true
      });

      await message.reply(`Successfully added ${userToAdd} to the ticket.`);

    } catch (error) {
      console.error('[ADD COMMAND] Error:', error);
      message.reply('An error occurred while adding the user to the ticket.');
    }
  }
};