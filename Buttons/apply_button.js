const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const https = require('https');

let verificationConnection = null;

async function getVerificationConnection() {
  if (!verificationConnection || verificationConnection.readyState === 0) {
    verificationConnection = await mongoose.createConnection(process.env.MONGO_URI2).asPromise();
  }
  return verificationConnection;
}

const userSchema = new mongoose.Schema({
  duid: { type: String, required: true },
  ruid: { type: String, required: false },
  robloxUsername: { type: String, required: false },
  robloxAccountCreated: { type: String, required: false },
  robloxAvatarUrl: { type: String, required: false },
  verifiedAt: { type: Date, default: Date.now }
}, { collection: 'verifications' });

const SUPPORT_ROLE_ID = '1451816560804102244';

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
      console.log('[APPLICATION] Button clicked by:', interaction.user.id);

      if (interaction.replied || interaction.deferred) {
        console.log('[APPLICATION] Interaction already acknowledged, skipping');
        return;
      }

      if (interaction.member.roles.cache.has(SUPPORT_ROLE_ID)) {
        console.log('[APPLICATION] User already has support role');
        return await interaction.reply({
          content: 'You already have the support role.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('[APPLICATION] Connecting to verification database...');
      const conn = await getVerificationConnection();
      console.log('[APPLICATION] Connection state:', conn.readyState);
      
      const User = conn.model('verification', userSchema);

      console.log('[APPLICATION] Searching for user with duid:', interaction.user.id);
      const userData = await User.findOne({ duid: interaction.user.id });
      
      console.log('[APPLICATION] User data found:', userData ? 'YES' : 'NO');
      if (userData) {
        console.log('[APPLICATION] User data:', {
          duid: userData.duid,
          ruid: userData.ruid,
          robloxUsername: userData.robloxUsername,
          hasRuid: !!userData.ruid
        });
      }

      if (!userData || !userData.ruid) {
        console.log('[APPLICATION] User not verified - no ruid found');
        return await interaction.reply({
          content: ':warnings: No Roblox information found! Please **verify** [here.](https://www.lynxguard.xyz/verification)',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('[APPLICATION] User verified, fetching Roblox info...');

      const robloxInfo = await fetchRobloxUserInfo(userData.ruid);
      console.log('[APPLICATION] Roblox info fetched:', robloxInfo);

      console.log('[APPLICATION] Sending initial reply...');

      await interaction.reply({
        content: '<:support_notify:1451073086651633756>  An application for **LynxGuard Support** has been sent to your DM\'s.',
        flags: MessageFlags.Ephemeral
      });

      console.log('[APPLICATION] Reply sent, now sending DM...');

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
                content: `# <:file:1451072954426458132> Support Application\n\n### <:Discord:1451072525454016674>  Account Information\n- Discord User: <@${interaction.user.id}> \`(${interaction.user.id})\`\n- Account Made: ${accountCreated}\n- Joined Server: ${joinedServer}\n\n<:prestige_roblox:1451802498083061810>  **Roblox Information:**\n- Roblox Username: ${robloxInfo.username}\n- Account Made: ${robloxInfo.created}\n\n`
              }
            ],
            accessory: {
              type: 2,
              style: 5,
              label: "Re-link Information",
              url: "https://www.lynxguard.xyz/verification"
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

      console.log('[APPLICATION] DM sent successfully');

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

      console.log('[APPLICATION] Application state initialized');

    } catch (error) {
      console.error('[APPLICATION] Error handling application button:', error);
      console.error('[APPLICATION] Error stack:', error.stack);
      
      if (error.code === 50007) {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            content: ' I cannot send you a DM. Please enable DMs from server members and try again.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `An error occurred: ${error.message}`,
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  }
};