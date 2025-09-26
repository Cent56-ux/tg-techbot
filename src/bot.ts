import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, eventsList, actionKeyboard, editMenuKeyboard } from './ui/messages';
import { listUpcoming, nextEvent, updateEvent, type EventRow } from './tools/events';
import { setParticipant } from './tools/participants';

// Bot-Instanz
export const bot = new Telegraf(CFG.botToken);

// --- ab hier kommen deine Commands/Handler wie gehabt ---
// (id, events, next, status, edit, message, callback_query usw.)
// Falls der Code schon drin ist, einfach dranlassen!
