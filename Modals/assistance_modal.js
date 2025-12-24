const { 
  MessageFlags, 
  PermissionFlagsBits,
  ChannelType,
  ContainerBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize
} = require('discord.js');
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

const verificationSchema = new mongoose.Schema({
  duid: String,
  ruid: String
});

async function connectMainDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
}

async function connectVerificationDB() {
  const conn = mongoose.createConnection(process.env.MONGO_URI2);
  return conn;
}

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

function generateTicketId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${timestamp}-${random}`.toUpperCase();
}

module.exports = {
  customID: 'assistance',
  
  async execute(interaction, client, args) {
    console.log('[MODAL DEBUG] Modal handler called');
    console.log('[MODAL DEBUG] CustomID:', interaction.customId);
    console.log('[MODAL DEBUG] Args:', args);
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const ticketType = interaction.fields.getStringSelectValues('ticket_type')[0];
      const reason = interaction.fields.getTextInputValue('reason_input');
      const serverId = interaction.fields.getTextInputValue('server_id_input');

      const channelMap = {
       'billing': '1452913780836274316',
        'general': '1452914197879984278',
        'developer': '1452914261734195271'
      };

      const typeNames = {
        'billing': 'Billing Support',
        'general': 'General Support',
        'developer': 'Developer Support'
      };

      const ticketPrefixes = {
        'billing': 'bill',
        'general': 'gen',
        'developer': 'dev'
      };

      const categoryId = channelMap[ticketType];
      const typeName = typeNames[ticketType];
      const prefix = ticketPrefixes[ticketType];

      const category = await client.channels.fetch(categoryId);
      if (!category || category.type !== ChannelType.GuildCategory) {
        return await interaction.editReply({
          content: 'Unable to create ticket. Category not found.'
        });
      }

      const channelName = `${prefix}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const ticketId = generateTicketId();

      console.log('[TICKET] Creating channel:', channelName, 'in category:', categoryId);

      const supportRoles = ['1448100092358823966', '1448906996421099561', '1448097004470145095', '1448096870508400640', '1448098877327806638'];

      const permissionOverwrites = [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels
          ]
        }
      ];

      for (const roleId of supportRoles) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          });
        }
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: permissionOverwrites
      });

      console.log('[TICKET] Channel created:', ticketChannel.id, ticketChannel.name);

      await connectMainDB();

      const newTicket = await Ticket.create({
        channelId: ticketChannel.id,
        userId: interaction.user.id,
        ticketId: ticketId,
        guildId: interaction.guild.id,
        ticketType: ticketType,
        reason: reason
      });

      console.log('[TICKET] Saved to database:', newTicket.ticketId);

      let robloxUsername = 'Not Linked';
      let robloxId = 'N/A';
      let robloxAccountAge = 'Unknown';
      let avatarUrl = 'https://tr.rbxcdn.com/30DAY-AvatarHeadshot-F5A98FAFDC2A34253E21E4774AA4D6EF-Png/150/150/AvatarHeadshot/Png/noFilter';

      try {
        const verificationConn = await connectVerificationDB();
        const VerificationModel = verificationConn.model('verification', verificationSchema);
        
        const userVerification = await VerificationModel.findOne({ duid: interaction.user.id });
        
        if (userVerification && userVerification.ruid) {
          robloxId = userVerification.ruid;
          
          const robloxResponse = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
          if (robloxResponse.ok) {
            const robloxData = await robloxResponse.json();
            robloxUsername = robloxData.name;
            robloxAccountAge = `<t:${Math.floor(new Date(robloxData.created).getTime() / 1000)}:R>`;
          }
          
          avatarUrl = `https://tr.rbxcdn.com/30DAY-AvatarHeadshot-${robloxId}-Png/150/150/AvatarHeadshot/Png/noFilter`;
        }
        
        await verificationConn.close();
      } catch (error) {
        console.error('[TICKET] Error fetching Roblox info:', error);
      }

      const discordAccountAge = `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`;

      const pingMessage = await ticketChannel.send(`<@&1448100092358823966>`);
      await pingMessage.delete();

      console.log('[TICKET] Building embed...');

      const container = new ContainerBuilder()
        .addSectionComponents((section) =>
          section
            .addTextDisplayComponents((textDisplay) =>
              textDisplay.setContent(
                `# <:Logo:1447758148722233425>  ${typeName}\n> Thank you for opening a ticket. Please provide clear and complete information so we can assist you efficiently.\n### User Information:\n**Roblox:** [${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile) \`(${robloxId})\`\n**Account Made:** ${robloxAccountAge}\n**Discord:** ${interaction.user} \`(${interaction.user.id})\`\n**Account Made:** ${discordAccountAge}\n\n`
              )
            )
            .setThumbnailAccessory((thumbnail) =>
              thumbnail
                .setURL(avatarUrl)
            )
        )
        .addSeparatorComponents((separator) =>
          separator
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents((textDisplay) =>
          textDisplay.setContent(
            `## Inquiry Information\n**Inquiry:** ${reason}\n**Guild ID:** ${serverId}\n-# Ticket ID: ${ticketId}`
          )
        );

      await ticketChannel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

      console.log('[TICKET] Embed sent to channel');

      await interaction.editReply({
        content: ` Ticket created for **${typeName.toLowerCase()}** ${ticketChannel}`
      });

      console.log('[TICKET] Ticket creation complete!');

    } catch (error) {
      console.error('[TICKET] Error creating ticket:', error);
      
      const errorMessage = {
        content: 'An error occurred while creating your ticket. Please try again later.'
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply({ ...errorMessage, flags: MessageFlags.Ephemeral });
      }
    }
  }
};