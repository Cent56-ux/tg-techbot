"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const config_1 = require("./config");
const bot_1 = require("./bot");
const scheduler_1 = require("./scheduler");
async function main() {
    (0, config_1.requireEnv)(['TELEGRAM_BOT_TOKEN']);
    await bot_1.bot.launch({ dropPendingUpdates: true });
    console.log('Bot launched ✅');
    setInterval(() => { (0, scheduler_1.tick)().catch(err => console.error('tick error', err)); }, 60000);
    process.once('SIGINT', () => bot_1.bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot_1.bot.stop('SIGTERM'));
}
main().catch(err => {
    console.error('Fatal startup error', err);
    process.exit(1);
});
