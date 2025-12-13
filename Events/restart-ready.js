const fs = require('fs');

module.exports = {
    name: 'clientReady',
    once: false,
    async execute(client) {
        
        if (!fs.existsSync('./restart.json')) return;
        
        try {
            const restartData = JSON.parse(fs.readFileSync('./restart.json', 'utf8'));
            
            const channel = await client.channels.fetch(restartData.channelId);
            const message = await channel.messages.fetch(restartData.messageId);
            
            await message.edit('All services operational.');
            
           
            fs.unlinkSync('./restart.json');
            
            console.log('[RESTART] Successfully updated restart message');
        } catch (error) {
            console.error('[RESTART] Failed to update restart message:', error);
            
            if (fs.existsSync('./restart.json')) {
                fs.unlinkSync('./restart.json');
            }
        }
    }
};