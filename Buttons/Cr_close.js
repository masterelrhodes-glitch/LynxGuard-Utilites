const { MessageFlags } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const mongoose = require('mongoose');

const GITHUB_OWNER = 'masterelrhodes-glitch';
const GITHUB_REPO = 'lynxguard-transcripts';
const VERCEL_URL = 'https://transcripts.lynxguard.xyz';
const LOG_CHANNEL_ID = '1453241278421532855';

let Octokit;
let octokit;

async function initOctokit() {
  if (!Octokit) {
    const octokitModule = await import('@octokit/rest');
    Octokit = octokitModule.Octokit;
    octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokit;
}

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

async function uploadToGitHub(fileName, fileContent) {
  const octokitInstance = await initOctokit();
  const content = fileContent.toString('base64');
  await octokitInstance.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: `public/${fileName}`,
    message: `Add transcript ${fileName}`,
    content: content,
    branch: 'main'
  });
  console.log(`Uploaded ${fileName} to GitHub`);
}

module.exports = {
  customID: 'crclose',
  skipSplit: false,
  
  async execute(interaction, client, args) {
    const ticketId = args[0];
    const requesterId = args[1];

    await new Promise(resolve => setTimeout(resolve, 1100)); 
    
    const ticket = await Ticket.findOne({ ticketId: ticketId });
    if (!ticket) {
      return await interaction.reply({ content: 'Ticket not found in database.' });
    }

    const ticketOwner = await client.users.fetch(ticket.userId);
    
    let channel;
    try {
      channel = await client.channels.fetch(ticket.channelId);
    } catch (error) {
      console.error('Error fetching channel:', error);
      return await interaction.reply({ content: 'Could not find the ticket channel.' });
    }

    try {
      const message = await channel.messages.fetch(interaction.message.id);
      await message.delete();
    } catch (error) {
      console.error('Error deleting close request message:', error);
    }

    await interaction.reply({ content: 'Closing ticket...' });
    await channel.send('Generating transcript and closing ticket...');

    const attachment = await discordTranscripts.createTranscript(channel, {
      limit: -1,
      returnType: 'buffer',
      filename: `transcript-${ticket.ticketId}.html`,
      poweredBy: false
    });

    const fileName = `transcript-${ticket.ticketId}-${Date.now()}.html`;
    const transcriptUrl = `${VERCEL_URL}/${fileName}`;

    await uploadToGitHub(fileName, attachment);
    await new Promise(resolve => setTimeout(resolve, 3000));

    const closedDate = new Date();
    const closureReason = 'Closed via close request';
    
    await Ticket.findOneAndUpdate(
      { channelId: channel.id },
      {
        dateClosed: closedDate,
        closedBy: requesterId,
        closureReason: closureReason,
        transcriptLink: transcriptUrl
      }
    );

    const logContainer = {
      type: 17,
      components: [
        {
          type: 10,
          content: `## Ticket Closed\n> Ticket **${channel.name}** has been closed by <@${requesterId}>\n### Ticket Information\n> Opened By: <@${ticket.userId}>\n> Opened Date: <t:${Math.floor(ticket.dateMade.getTime() / 1000)}:F>\n> Category: ${ticket.ticketType}\n> Closed By: <@${requesterId}>\n> Closing Date: <t:${Math.floor(closedDate.getTime() / 1000)}:F>\n`
        },
        {
          type: 14,
          spacing: 2
        },
        {
          type: 9,
          components: [
            {
              type: 10,
              content: `Opening Reason:\n\`\`\`${ticket.reason}\`\`\`\nClosure Reason:\n\`\`\`${closureReason}\`\`\`\n-# Ticket ID: ${ticket.ticketId}`
            }
          ],
          accessory: {
            type: 2,
            style: 5,
            label: 'Transcript Link',
            url: transcriptUrl
          }
        }
      ]
    };

    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      await logChannel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [logContainer]
      });
    } catch (error) {
      console.error('Error sending to log channel:', error);
    }

    try {
      await ticketOwner.send({
        embeds: [{
          title: 'Ticket Closure',
          description: `> Thanks for contacting LynxGuard Support, If you experience any further issues or have additional questions, feel free to open a new ticket at any time. Thank you for your patience and for reaching out to our support team.\n-# Ticket ID: ${ticket.ticketId}`
        }]
      });
    } catch (error) {
      console.log(`Could not DM ${ticketOwner.tag}`);
      await channel.send({
        content: `<@${ticketOwner.id}> I couldn't DM you. Here's your transcript link: ${transcriptUrl}`
      });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    try {
      const guild = channel.guild;
      const member = await guild.members.fetch(ticket.userId);
      const supportRole = '1448100092358223966';
      if (member && member.roles.cache.has(supportRole)) {
        await member.roles.remove(supportRole);
      }
    } catch (error) {
      console.error('Error removing support role:', error);
    }

    await channel.send('This ticket will be deleted in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await channel.delete();
      console.log(`Ticket ${ticket.ticketId} closed successfully via close request`);
    } catch (error) {
      console.error(`Error deleting channel: ${error.message}`);
    }
  }
};