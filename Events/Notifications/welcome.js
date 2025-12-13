const { Events } = require('discord.js');

const GUILD_ID = '1446351663622389770';
const WELCOME_CHANNEL_ID = '1447750142164733993'; 
const WELCOME_ROLE_ID = '1448097434768248924';    
const DASHBOARD_LINK = 'https://discord.com/channels/1446351663622389770/1447749004183081042'; 

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(client, member) {
    console.log('[WELCOME] Event triggered!');
    console.log('[WELCOME] Member:', member.user?.tag);
    
    try {
      const guild = await client.guilds.fetch(GUILD_ID);
      console.log('[WELCOME] Guild:', guild.name);
      
      const welcomeChannel = await guild.channels.fetch(WELCOME_CHANNEL_ID);
      if (!welcomeChannel) {
        console.error(`[WELCOME] Channel ${WELCOME_CHANNEL_ID} not found`);
        return;
      }

      const fetchedMember = await guild.members.fetch(member.user.id);
      
      const role = await guild.roles.fetch(WELCOME_ROLE_ID);
      if (role) {
        await fetchedMember.roles.add(role);
        console.log(`[WELCOME] Assigned role ${role.name}`);
      } else {
        console.error(`[WELCOME] Role ${WELCOME_ROLE_ID} not found`);
      }

      const memberCount = guild.memberCount;

      const payload = {
        content: `Welcome to **${guild.name}**, <@${member.user.id}>! We're an AI moderation bot focused on keeping ER:LC communities safe 24/7.`,
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 2, 
                label: memberCount.toString(),
                emoji: {
                  id: '1447758148722233425',
                  name: 'Logo'
                },
                custom_id: 'member_count',
                disabled: true
              },
              {
                type: 2,
                style: 5, 
                label: 'Order',
                emoji: {
                  id: '1447758148722233425',
                  name: 'Logo'
                },
                url: DASHBOARD_LINK
              }
            ]
          }
        ]
      };

      await welcomeChannel.send(payload);
      console.log(`[WELCOME] Message sent successfully`);
      
    } catch (error) {
      console.error('[WELCOME] Error:', error);
    }
  }
};