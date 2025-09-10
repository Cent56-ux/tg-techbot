import OpenAI from 'openai';
import { CFG } from './config';
import { eventsCreate, nextEvent, statusFor } from './tools/events';
import { setParticipant } from './tools/participants';

const client = new OpenAI({ apiKey: CFG.openaiKey });

const SYSTEM = `Du bist der Orga-Assistent unserer Tech-Telegramgruppe.
- Zeitzone Europe/Berlin; gib Zeiten als ISO (UTC) an, wenn du Tools aufrufst.
- Nutze ausschließlich die bereitgestellten Tools.
- Fehlen Pflichtfelder, frage kurz nach. Keine langen Absätze.`;

export const tools: any[] = [
  { type: 'function', function: {
    name: 'events.create',
    description: 'Event anlegen (optional Zoom).',
    parameters: { type: 'object', properties: {
      title: { type: 'string' },
      start_at: { type: 'string', format: 'date-time' },
      duration_minutes: { type: 'integer', minimum: 15, maximum: 240 },
      presenter: { type: 'string' },
      description: { type: 'string' },
      create_zoom: { type: 'boolean', default: true }
    }, required: ['title','start_at','duration_minutes','presenter'] }
  }},
  { type: 'function', function: {
    name: 'participants.set',
    description: 'Teilnahmestatus setzen.',
    parameters: { type: 'object', properties: {
      event_id: { type: 'string' },
      tg_user_id: { type: 'integer' },
      display_name: { type: 'string' },
      status: { type: 'string', enum: ['going','maybe','declined'] }
    }, required: ['event_id','tg_user_id','status'] }
  }},
  { type: 'function', function: {
    name: 'events.status_next',
    description: 'Status des nächsten Events.',
    parameters: { type: 'object', properties: {} }
  }},
  { type: 'function', function: {
    name: 'announce.to_group',
    description: 'Gibt Text für eine Gruppenankündigung zurück.',
    parameters: { type: 'object', properties: {
      text: { type: 'string' }
    }, required: ['text'] }
  }},
];

export async function converse(userMsg: string, context: { tg_user_id: number; display_name?: string }) {
  const rsp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMsg }
    ],
    tools
  });

  const msg = rsp.choices[0].message;
  const call = msg.tool_calls?.[0];

  if (!call) {
    return { type: 'text', text: msg.content || '✅' };
    }

  const args = JSON.parse(call.function.arguments || '{}');

  switch (call.function.name) {
    case 'events.create': {
      const ev = await eventsCreate({ ...args, created_by: context.tg_user_id });
      return { type: 'event_created', event: ev };
    }
    case 'participants.set': {
      const row = await setParticipant({ ...args, tg_user_id: context.tg_user_id, display_name: context.display_name });
      return { type: 'text', text: `Status aktualisiert: ${row.status}` };
    }
    case 'events.status_next': {
      const ne = await nextEvent(new Date().toISOString());
      if (!ne) return { type: 'text', text: 'Kein kommendes Event.' };
      const st = await statusFor(ne.id);
      return { type: 'status', payload: st };
    }
    case 'announce.to_group': {
      return { type: 'announce', text: String(args.text || '') };
    }
    default:
      return { type: 'text', text: '🤖' };
  }
}
