"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const config_1 = require("./config");
const messages_1 = require("./ui/messages");
const events_1 = require("./tools/events");
exports.bot = new telegraf_1.Telegraf(config_1.CFG.botToken);
exports.bot.command('id', async (ctx) => {
    await ctx.reply(`chat id: ${ctx.chat?.id}`);
});
exports.bot.command('list', async (ctx) => {
    const events = await (0, events_1.listUpcoming)(5);
    if (!events.length) {
        await ctx.reply('📭 Keine anstehenden Events.');
        return;
    }
    await ctx.reply((0, messages_1.eventsList)(events));
});
exports.bot.command('next', async (ctx) => {
    const ev = await (0, events_1.nextEvent)();
    if (!ev) {
        await ctx.reply('📭 Kein kommendes Event gefunden.');
        return;
    }
    await ctx.reply((0, messages_1.eventCard)(ev), { reply_markup: (0, messages_1.actionKeyboard)(ev.id) });
});
