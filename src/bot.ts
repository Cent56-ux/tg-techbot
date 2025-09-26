import { Telegraf } from 'telegraf';
import { CFG } from './config';
import { converse } from './llm';
import { eventCard, eventsList, actionKeyboard, editMenuKeyboard } from './ui/messages';
import { listUpcoming, nextEvent, updateEvent, type EventRow } from './tools/events';
import { setParticipant } from './tools/participants';

export const bot = new Telegraf(CFG.botToken);

// ab hier deine Commands/Handler wie vorher
