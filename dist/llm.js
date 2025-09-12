"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tools = void 0;
exports.converse = converse;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("./config");
const events_1 = require("./tools/events");
const participants_1 = require("./tools/participants");
const client = new openai_1.default({ apiKey: config_1.CFG.openaiKey });
const SYSTEM = `Du bist der Orga-Assistent der Promptimals-Telegramgruppe.
- Heute ist ${new Date().toISOString()} (UTC).
- Zeitzone Europe/Berlin; gib Zeiten als ISO (UTC) an, wenn du Tools aufrufst.
- Nutze ausschließlich die bereitgestellten Tools.
- Fehlen Pflichtfelder, frage kurz nach. Keine langen Absätze.`;
// Tool-Namen: nur a-zA-Z0-9_-
exports.tools = [
    { type: 'function', function: {
            name: 'events_create',
            description: 'Event anlegen (optional Zoom).',
            parameters: { type: 'object', properties: {
                    title: { type: 'string' },
                    start_at: { type: 'string', format: 'date-time' },
                    duration_minutes: { type: 'integer', minimum: 15, maximum: 240 },
                    presenter: { type: 'string' },
                    description: { type: 'string' },
                    create_zoom: { type: 'boolean', default: true }
                }, required: ['title', 'start_at', 'duration_minutes', 'presenter'] }
        } },
    { type: 'function', function: {
            name: 'events_update',
            description: 'Bestehendes Event aktualisieren. Ohne id wird das nächste Event editiert.',
            parameters: { type: 'object', properties: {
                    id: { type: 'string', description: 'Event-ID (optional). Wenn leer, nimm das nächste Event.' },
                    patch: { type: 'object', properties: {
                            title: { type: 'string' },
                            start_at: { type: 'string', format: 'date-time' },
                            duration_minutes: { type: 'integer', minimum: 15, maximum: 240 },
                            presenter: { type: 'string' },
                            description: { type: 'string' },
                            recreate_zoom: { type: 'boolean', description: 'Wenn true, erzeuge neue Zoom-Einladung.' }
                        } }
                }, required: ['patch'] }
        } },
    { type: 'function', function: {
            name: 'participants_set',
            description: 'Teilnahmestatus setzen.',
            parameters: { type: 'object', properties: {
                    event_id: { type: 'string' },
                    tg_user_id: { type: 'integer' },
                    display_name: { type: 'string' },
                    status: { type: 'string', enum: ['going', 'maybe', 'declined'] }
                }, required: ['event_id', 'tg_user_id', 'status'] }
        } },
    { type: 'function', function: {
            name: 'events_status_next',
            description: 'Status des nächsten Events.',
            parameters: { type: 'object', properties: {} }
        } },
    { type: 'function', function: {
            name: 'events_list',
            description: 'Liste der kommenden Events.',
            parameters: { type: 'object', properties: {
                    limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
                }, required: [] }
        } },
    { type: 'function', function: {
            name: 'announce_to_group',
            description: 'Gibt Text für eine Gruppenankündigung zurück.',
            parameters: { type: 'object', properties: {
                    text: { type: 'string' }
                }, required: ['text'] }
        } },
];
async function converse(userMsg, context) {
    let rsp;
    try {
        rsp = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: userMsg }
            ],
            tools: exports.tools
        });
    }
    catch (e) {
        console.error('OpenAI error', e);
        return { type: 'text', text: '⚠️ Konnte das gerade nicht verarbeiten.' };
    }
    const msg = rsp.choices[0].message;
    const call = msg.tool_calls?.[0];
    if (!call || call.type !== 'function' || !('function' in call)) {
        return { type: 'text', text: msg.content || '✅' };
    }
    const args = JSON.parse(call.function.arguments || '{}');
    switch (call.function.name) {
        case 'events_create': {
            const ev = await (0, events_1.eventsCreate)({ ...args, created_by: context.tg_user_id });
            return { type: 'event_created', event: ev };
        }
        case 'events_update': {
            const ev = await (0, events_1.updateEvent)(args);
            return { type: 'event_updated', event: ev };
        }
        case 'participants_set': {
            const row = await (0, participants_1.setParticipant)({ ...args, tg_user_id: context.tg_user_id, display_name: context.display_name });
            return { type: 'text', text: `Status aktualisiert: ${row.status}` };
        }
        case 'events_status_next': {
            const ne = await (0, events_1.nextEvent)(new Date().toISOString());
            if (!ne)
                return { type: 'text', text: 'Kein kommendes Event.' };
            const st = await (0, events_1.statusFor)(ne.id);
            return { type: 'status', payload: st };
        }
        case 'events_list': {
            const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(10, Number(args.limit))) : 5;
            const events = await (0, events_1.listUpcoming)(limit);
            return { type: 'events_list', events };
        }
        case 'announce_to_group': {
            return { type: 'announce', text: String(args.text || '') };
        }
        default:
            return { type: 'text', text: '🤖' };
    }
}
