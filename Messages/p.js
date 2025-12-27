module.exports = {
  name: "p",
  description: "Purge messages",
  cooldown: 0,

  async execute(message, client, args) {
    const allowedUsers = new Set([
      "792112541367140363",
      "1148461055656329266",
      "1407159375164084276",
      "634140757812314114",
      "868878729236078592"
    ]);

    if (!allowedUsers.has(message.author.id)) return;

    const amount = parseInt(args[0], 10);

    if (isNaN(amount) || amount < 1 || amount > 99) return;

    try {
      const messages = await message.channel.messages.fetch({ limit: amount + 1 });

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
