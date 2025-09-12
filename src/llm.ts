import OpenAI from 'openai';
import { CFG } from './config';
import { eventsCreate, nextEvent, statusFor, listUpcoming } from './tools/events';
import { setParticipant } from './tools/participants';

const client = new OpenAI({ apiKey: CFG.openaiKey });

const SYSTEM = `Du bist der Orga-Assistent der Promptimals-Telegramgruppe.
- Heute ist ${new Date().toISOString()} (UTC).
- Zeitzone Europe/Berlin; gib Zeiten als ISO (UTC) an, wenn du Tools aufrufst.
- Nutze ausschließlich die bereitgestellten Tools.
- Fehlen Pflichtfelder, frage kurz nach. Keine langen Absätze.`;

// Tool-Namen: nur a-zA-Z0-9_-
export const tools: any[] = [
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
    }, required: ['title','start_at','duration_minutes','presenter'] }
  }},
  { type: 'function', function: {
    name: 'participants_set',
    description: 'Teilnahmestatus setzen.',
    parameters: { type: 'object', properties: {
      event_id: { type: 'string' },
      tg_user_id: { type: 'integer' },
      display_name: { type: 'string' },
      status: { type: 'string', enum: ['going','maybe','declined'] }
    }, required: ['event_id','tg_user_id','status'] }
  }},
  { type: 'function', function: {
    name: 'events_status_next',
    description: 'Status des nächsten Events.',
    parameters: { type: 'object', properties: {} }
  }},
  { type: 'function', function: {
    name: 'events_list',
    description: 'Liste der kommenden Events.',
    parameters: { type: 'object', properties: {
      limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 }
    }, required: [] }
  }},
  { type: 'function', function: {
    name: 'announce_to_group',
    description: 'Gibt Text für eine Gruppenankündigung zurück.',
    parameters: { type: 'object', properties: {
      text: { type: 'string' }
    }, required: ['text'] }
  }},
];

export async function converse(userMsg: string, context: { tg_user_id: number; display_name?: string }) {
  let rsp;
  try {
    rsp = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMsg }
      ],
      tools
    });
  } catch (e:any) {
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
      const ev = await eventsCreate({ ...args, created_by: context.tg_user_id });
      return { type: 'event_created', event: ev };
    }
    case 'participants_set': {
      const row = await setParticipant({ ...args, tg_user_id: context.tg_user_id, display_name: context.display_name });
      return { type: 'text', text: `Status aktualisiert: ${row.status}` };
    }
    case 'events_status_next': {
      const ne = await nextEvent(new Date().toISOString());
      if (!ne) return { type: 'text', text: 'Kein kommendes Event.' };
      const st = await statusFor(ne.id);
      return { type: 'status', payload: st };
    }
    case 'events_list': {
      const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(10, Number(args.limit))) : 5;
      const events = await listUpcoming(limit);
      return { type: 'events_list', events };
    }
    case 'announce_to_group': {
      return { type: 'announce', text: String(args.text || '') };
    }
    default:
      return { type: 'text', text: '🤖' };
  }
}
