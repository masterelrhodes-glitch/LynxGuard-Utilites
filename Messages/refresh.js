const axios = require('axios');
const mongoose = require('mongoose');

let verificationConnection;
let UserModel;

async function initVerificationDB() {
  if (!verificationConnection) {
    verificationConnection = mongoose.createConnection(process.env.MONGO_URI2);
    
    const schema = new mongoose.Schema({
      duid: String,
      ruid: String
    });
    
    UserModel = verificationConnection.model('verification', schema);
  }
  return UserModel;
}

module.exports = {
  name: 'refresh',
  description: 'Update a user\'s server nickname to their Roblox username',
  async execute(message, client, args) {
    const allowedRoles = ['1448098877327806638', '1448100092358823966'];
    const hasPermission = message.member.roles.cache.some(role => 
      allowedRoles.includes(role.id)
    );

    if (!hasPermission) {
      return message.reply('You do not have permission to use this command.');
    }

    if (!args[0]) {
      return message.reply('Please provide a user mention or ID. Usage: `-refresh @user` or `-refresh 123456789`');
    }

    let targetUserId;
    const mentionMatch = args[0].match(/^<@!?(\d+)>$/);
    targetUserId = mentionMatch ? mentionMatch[1] : args[0];

    try {
      const member = await message.guild.members.fetch(targetUserId).catch(() => null);
      if (!member) {
        return message.reply('Could not find that user in this server.');
      }

      await initVerificationDB();
      const userData = await UserModel.findOne({ duid: targetUserId });

      if (!userData || !userData.ruid) {
        return message.reply('This user is not verified in the database.');
      }

      const robloxResponse = await axios.get(`https://users.roblox.com/v1/users/${userData.ruid}`);
      const robloxUsername = robloxResponse.data.name;

      await member.setNickname(robloxUsername);

      await message.reply({
        content: `Successfully updated <@${targetUserId}>'s nickname to **${robloxUsername}**`,
        allowedMentions: { users: [] }
      });

    } catch (error) {
      console.error('Error in refresh command:', error);
      
      if (error.response?.status === 404) {
        return message.reply('Could not find that Roblox user. The account may have been deleted.');
      }
      
      if (error.code === 50013) {
        return message.reply('I don\'t have permission to change that user\'s nickname. They may have a higher role than me.');
      }

      await message.reply('An error occurred while updating the nickname. Please try again.');
    }
  }
};