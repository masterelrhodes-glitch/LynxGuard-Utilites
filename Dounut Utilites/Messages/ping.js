const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: "ping",
  description: "Shows bot status",
  cooldown: 0,

  execute(message, client, args) {
    const now = Date.now();
    const startedAt = now - client.uptime; 
    const ping = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle("Bot Status")
      .setColor("#2f3136")
      .addFields(
        { name: "Uptime", value: `<t:${Math.floor(startedAt / 1000)}:R>`, inline: true },
        { name: "Ping", value: `${ping}ms`, inline: true }
      )
      .setFooter({ text: `Data requested by ${message.member?.nickname || message.author.username}` })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
