const AUTHORIZED_USERS = ['792112541367140363', '1148461055656329266'];

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;
        if (message.content !== '$restart') return;
        if (!AUTHORIZED_USERS.includes(message.author.id)) return;

        const reply = await message.reply('Restarting Services...');
        
        
        const restartData = {
            messageId: reply.id,
            channelId: message.channel.id,
            timestamp: Date.now()
        };
        
        
        const fs = require('fs');
        fs.writeFileSync('./restart.json', JSON.stringify(restartData));
        
        
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
};