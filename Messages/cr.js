const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

const ALLOWED_ROLES = ['1448100092358823966', '1448906996421099561', '1448097004470145095', '1448096870508400640', '1448098877327806638'];

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

module.exports = {
  name: 'cr',
  description: 'Request to close a ticket',
  roles: ALLOWED_ROLES,
  
  async execute(message, client, args) {
    const hasRole = message.member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
    if (!hasRole) {
      return await message.reply('You do not have permission to use this command.');
    }

    const ticket = await Ticket.findOne({ channelId: message.channel.id });
    if (!ticket) {
      return; 
    }

    const reason = args.join(' ') || 'No reason provided';

    await message.delete().catch(() => {});

    await message.channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [{
        type: 17,
        components: [
          {
            type: 10,
            content: `<@${ticket.userId}>\n## Ticket Close Request\n> We believe your issue has been successfully resolved based on the information and actions taken during this ticket. If you are no longer experiencing the problem, this ticket will be closed shortly. Should the issue persist or return, please let us know before closure or open a new ticket at any time so we can continue assisting you.\n- Reason:\n\`\`\`${reason}\`\`\`\n-# Requested by: <@${message.author.id}>`
          },
          {
            type: 1,
            components: [
              {
                style: 3,
                type: 2,
                label: 'Close Ticket',
                custom_id: `crclose_${ticket.ticketId}_${message.author.id}`
              },
              {
                style: 4,
                type: 2,
                label: 'Cancel',
                custom_id: `crcancel_${ticket.ticketId}_${ticket.userId}`
              }
            ]
          }
        ]
      }]
    });
  }
};