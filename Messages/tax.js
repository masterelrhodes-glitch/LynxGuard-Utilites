module.exports = {
  name: "tax",
  description: "Calculates number × 1.3",
  cooldown: 0,

  execute(message, client, args) {
    const input = parseFloat(args[0]);

    if (isNaN(input)) {
      return message.reply("Please provide a valid number. Example: `-tax 100`");
    }

    const rawResult = input * 1.3;
    const roundedResult = Math.round(rawResult);

    
    message.reply(
      `<:Calculator:1443036173852213259> You entered a price of **${input}** robux, with tax the final cost would be **${roundedResult}** robux.`
    );
  },
};
