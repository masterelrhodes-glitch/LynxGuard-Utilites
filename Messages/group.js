const axios = require('axios');

const groupId = '117652749';

module.exports = {
  name: 'group',
  description: 'Display group information',
  async execute(message, args) {
    try {
      const groupResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}`);
      const groupData = groupResponse.data;

      const groupName = groupData.name;
      const groupDescription = groupData.description?.trim().length > 0
        ? groupData.description
        : 'At this time, this teams description will not be provided.';
      const memberCount = groupData.memberCount;
      const ownerId = groupData.owner.userId;
      const ownerName = groupData.owner.username;
      const ownerLink = `https://www.roblox.com/users/${ownerId}/profile`;
      const groupUrl = `https://www.roblox.com/groups/${groupId}`;

      const rolesResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
      const adminRole = rolesResponse.data.roles.find(r => r.rank >= 200);
      let administrators = [];

      if (adminRole) {
        const adminsResponse = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles/${adminRole.id}/users?limit=100`);
        administrators = adminsResponse.data.data.map(user => ({
          name: user.username,
          link: `https://www.roblox.com/users/${user.userId}/profile`
        }));
      }

      const adminLines = administrators.length > 0
        ? administrators.map(a => `  * [${a.name}](${a.link})`).join('\n')
        : '  * None';

      const payload = {
        flags: 32768,
        components: [
          {
            type: 17,
            components: [
              {
                type: 10,
                content: `## <:ch_market:1446338516304003214>  [${groupName}](${groupUrl})\n${groupDescription}\n\n* **Member Count:** ${memberCount}\n* **Group Owner:** [${ownerName}](${ownerLink})\n* **Group Administrators:**\n${adminLines}`
              },
              {
                type: 14
              },
              {
                type: 12,
                items: [
                  {
                    media: {
                      url: "https://media.discordapp.net/attachments/1446340318009229412/1446340426071146597/Artboard_3_22x.png?ex=6933a0fd&is=69324f7d&hm=f2bb1b529b516ca31babac28b0828da560d37bb9199c0505dac1fd0accb9edd6&=&format=png&quality=lossless&width=1783&height=85"
                    }
                  }
                ]
              }
            ],
            accent_color: 28306353
          },
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: "Join Today!",
                emoji: {
                  id: "1443826058561323109",
                  name: "Roblox",
                  animated: false
                },
                url: groupUrl
              }
            ]
          }
        ]
      };

      await message.reply(payload);
    } catch (error) {
      console.error(error);
      await message.reply('Failed to fetch group information. Please check the group ID.');
    }
  }
};
