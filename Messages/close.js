const { MessageFlags } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const mongoose = require('mongoose');

const GITHUB_OWNER = 'masterelrhodes-glitch';
const GITHUB_REPO = 'lynxguard-transcripts';
const VERCEL_URL = 'https://transcripts.lynxguard.xyz';
const LOG_CHANNEL_ID = '1453241278421532855';
const ALLOWED_ROLES = ['1448100092358823966', '1448906996421099561', '1448097004470145095', '1448096870508400640', '1448098877327806638'];

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

const closingChannels = new Set();

module.exports = {
  name: 'close',
  description: 'Close a ticket and generate transcript',
  roles: ALLOWED_ROLES,
  
  async execute(message, client, args) {
    if (closingChannels.has(message.channel.id)) {
      console.log(`[CLOSE] Channel ${message.channel.id} is already being closed, ignoring duplicate request`);
      return;
    }

    const hasRole = message.member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
    if (!hasRole) {
      return await message.reply('You do not have permission to use this command.');
    }

    const ticket = await Ticket.findOne({ channelId: message.channel.id });
    if (!ticket) {
      return await message.reply('This command can only be used in ticket channels.');
    }

    closingChannels.add(message.channel.id);

    const closureReason = args.join(' ') || 'No reason provided';
    const ticketOwner = await client.users.fetch(ticket.userId);

    await message.reply('Generating transcript and closing ticket...');

    const attachment = await discordTranscripts.createTranscript(message.channel, {
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
    await Ticket.findOneAndUpdate(
      { channelId: message.channel.id },
      {
        dateClosed: closedDate,
        closedBy: message.author.id,
        closureReason: closureReason,
        transcriptLink: transcriptUrl
      }
    );

    const logContainer = {
      type: 17,
      components: [
        {
          type: 10,
          content: `## Ticket Closed\n> Ticket **${message.channel.name}** has been closed by <@${message.author.id}>\n### Ticket Information\n> Opened By: <@${ticket.userId}>\n> Opened Date: <t:${Math.floor(ticket.dateMade.getTime() / 1000)}:F>\n> Category: ${ticket.ticketType}\n> Closed By: <@${message.author.id}>\n> Closing Date: <t:${Math.floor(closedDate.getTime() / 1000)}:F>\n`
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

    const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
    console.log('Log channel ID:', LOG_CHANNEL_ID);
    console.log('Log channel found:', !!logChannel);
    if (logChannel) {
      console.log('Sending to log channel...');
      await logChannel.send({
        flags: MessageFlags.IsComponentsV2,
        components: [logContainer]
      });
      console.log('Log message sent successfully');
    } else {
      console.log('Log channel not found!');
    }

    try {
      await ticketOwner.send({
        embeds: [{
          title: 'Ticket Closure',
          description: `> Thanks for contacting LynxGuard Support, If you experience any further issues or have additional questions, feel free to open a new ticket at any time. Thank you for your patience and for reaching out to our support team.\n-# Ticket ID: ${ticket.ticketId}`
        }]
      });
      console.log(`DM sent to ${ticketOwner.tag}`);
    } catch (error) {
      console.log(`Could not DM ${ticketOwner.tag}`);
      await message.channel.send({
        content: `<@${ticketOwner.id}> I couldn't DM you. Here's your transcript link: ${transcriptUrl}`
      });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    try {
      const member = await message.guild.members.fetch(ticket.userId);
      const supportRole = '1448100092358223966';
      if (member.roles.cache.has(supportRole)) {
        await member.roles.remove(supportRole);
      }
    } catch (error) {
      console.error('Error removing support role:', error);
    }

    await message.channel.send('This ticket will be deleted in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      await message.channel.delete();
      console.log(`Ticket ${ticket.ticketId} closed successfully`);
    } catch (error) {
      console.error(`Error deleting channel: ${error.message}`);
    } finally {
      closingChannels.delete(message.channel.id);
    }
  }
};