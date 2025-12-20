const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const https = require('https');

let verificationConnection = null;
let applicationConnection = null;

async function getVerificationConnection() {
  if (!verificationConnection || verificationConnection.readyState === 0) {
    verificationConnection = await mongoose.createConnection(process.env.MONGO_URI2).asPromise();
  }
  return verificationConnection;
}

async function getApplicationConnection() {
  if (!applicationConnection || applicationConnection.readyState === 0) {
    applicationConnection = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  }
  return applicationConnection;
}

const userSchema = new mongoose.Schema({
  duid: { type: String, required: true },
  ruid: { type: String, required: false },
  robloxUsername: { type: String, required: false },
  robloxAccountCreated: { type: String, required: false },
  robloxAvatarUrl: { type: String, required: false },
  verifiedAt: { type: Date, default: Date.now }
}, { collection: 'verifications' });

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String, required: true, unique: true },
  discordUserId: { type: String, required: true },
  discordUsername: { type: String, required: true },
  robloxUserId: { type: String, required: true },
  robloxUsername: { type: String, required: true },
  status: { type: String, enum: ['not reviewed', 'staged', 'accepted', 'denied'], default: 'not reviewed' },
  answers: {
    pastSupport: String,
    serversWorked: String,
    discordJsKnowledge: String,
    question3: String,
    question4: String,
    question5: String,
    question6: String,
    question7: String
  },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'applications', timestamps: true });

const SUPPORT_ROLE_ID = '1448100092358823966';

const { applicationStates } = require('../Utils/applicationState');

async function fetchRobloxUserInfo(ruid) {
  return new Promise((resolve) => {
    https.get(`https://users.roblox.com/v1/users/${ruid}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const createdTimestamp = parsed.created 
            ? `<t:${Math.floor(new Date(parsed.created).getTime() / 1000)}:D>`
            : 'Unknown';
          resolve({
            username: parsed.name || parsed.displayName || 'Unknown',
            created: createdTimestamp
          });
        } catch (e) {
          resolve({ username: 'Unknown', created: 'Unknown' });
        }
      });
    }).on('error', () => {
      resolve({ username: 'Unknown', created: 'Unknown' });
    });
  });
}

module.exports = {
  customID: 'apply_button',
  async execute(interaction) {
    try {
      if (interaction.replied || interaction.deferred) {
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      if (interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
        return await interaction.editReply({
          content: 'You already have the support role.'
        });
      }

      const conn = await getVerificationConnection();
      const User = conn.model('verification', userSchema);
      const userData = await User.findOne({ duid: interaction.user.id });

      if (!userData || !userData.ruid) {
        return await interaction.editReply({
          content: 'No Roblox information found! Please verify here: https://verify.lynxguard.xyz'
        });
      }

      if (applicationStates.has(interaction.user.id)) {
        return await interaction.editReply({
          content: 'You already have an active application in progress. Please complete or cancel it before starting a new one.'
        });
      }

      const appConn = await getApplicationConnection();
      const Application = appConn.model('Application', applicationSchema);

      const existingApplication = await Application.findOne({
        $or: [
          { discordUserId: interaction.user.id },
          { robloxUserId: userData.ruid }
        ],
        status: { $in: ['not reviewed', 'staged'] }
      });

      if (existingApplication) {
        return await interaction.editReply({
          content: `You already have a pending application (ID: \`${existingApplication.applicationId}\`). Please wait for it to be reviewed before submitting a new one.`
        });
      }

      const robloxInfo = await fetchRobloxUserInfo(userData.ruid);

      await interaction.editReply({
        content: 'An application for LynxGuard Support has been sent to your DMs.'
      });

      const dmChannel = await interaction.user.createDM();
      
      const accountCreated = `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:D>`;
      const joinedServer = interaction.member.joinedAt 
        ? `<t:${Math.floor(interaction.member.joinedTimestamp / 1000)}:D>` 
        : 'Unknown';

      const initialEmbed = {
        type: 17,
        components: [
          {
            type: 9,
            components: [
              {
                type: 10,
                content: `# Support Application\n\nAccount Information\n- Discord User: <@${interaction.user.id}> \`(${interaction.user.id})\`\n- Account Made: ${accountCreated}\n- Joined Server: ${joinedServer}\n\nRoblox Information:\n- Roblox Username: ${robloxInfo.username}\n- Account Made: ${robloxInfo.created}\n\n`
              }
            ],
            accessory: {
              type: 2,
              style: 5,
              label: "Re-link Information",
              url: "https://verify.lynxguard.xyz"
            }
          },
          {
            type: 1,
            components: [
              {
                style: 3,
                type: 2,
                label: "Continue",
                custom_id: `appcontinue_${interaction.user.id}`  
              },
              {
                style: 4,
                type: 2,
                label: "Cancel",
                custom_id: `appcancel_${interaction.user.id}`  
              }
            ]
          }
        ]
      };

      await dmChannel.send({
        components: [initialEmbed],
        flags: MessageFlags.IsComponentsV2
      });

      applicationStates.set(interaction.user.id, {
        stage: 'initial',
        userData: {
          ...userData.toObject(),
          robloxUsername: robloxInfo.username,
          robloxAccountCreated: robloxInfo.created
        },
        answers: {},
        attemptCounts: {},
        accountCreated: accountCreated,
        joinedServer: joinedServer,
        guildId: interaction.guildId
      });

    } catch (error) {
      if (error.code === 50007) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            content: 'I cannot send you a DM. Please enable DMs from server members and try again.',
            flags: MessageFlags.Ephemeral
          });
        } else {
          return await interaction.editReply({
            content: 'I cannot send you a DM. Please enable DMs from server members and try again.'
          });
        }
      }

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `An error occurred: ${error.message}`,
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      } else {
        await interaction.editReply({
          content: `An error occurred: ${error.message}`
        }).catch(() => {});
      }
    }
  }
};