"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const telegraf_1 = require("telegraf");
const config_1 = require("./config");
// Bot-Instanz
exports.bot = new telegraf_1.Telegraf(config_1.CFG.botToken);
// --- ab hier kommen deine Commands/Handler wie gehabt ---
// (id, events, next, status, edit, message, callback_query usw.)
// Falls der Code schon drin ist, einfach dranlassen!
