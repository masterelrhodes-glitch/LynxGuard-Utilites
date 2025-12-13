// p.js
module.exports = {
  name: "p",
  description: "Purge messages",
  cooldown: 0,

  async execute(message, client, args) {
    const allowedUsers = new Set([
      "792112541367140363",
      "1148461055656329266"
    ]);

    // Silent ignore for unauthorized users
    if (!allowedUsers.has(message.author.id)) return;

    const amount = parseInt(args[0], 10);

    // Silent ignore if invalid
    if (isNaN(amount) || amount < 1 || amount > 99) return;

    try {
      // Fetch messages in the CURRENT channel
      const messages = await message.channel.messages.fetch({ limit: amount + 1 });

      // Filter out messages older than 14 days
      const now = Date.now();
      const freshMessages = messages.filter(m => 
        (now - m.createdTimestamp) < 14 * 24 * 60 * 60 * 1000
      );

      if (!freshMessages.size) return;

      await message.channel.bulkDelete(freshMessages, true);
    } catch (err) {
      console.error("Purge error:", err);
    }
  }
};
