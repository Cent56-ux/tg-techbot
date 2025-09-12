import 'dotenv/config';
import { requireEnv } from './config';
import { bot } from './bot';
import { tick } from './scheduler';

async function main() {
  requireEnv(['TELEGRAM_BOT_TOKEN']);

  await bot.launch({ dropPendingUpdates: true });
  console.log('Bot launched ✅');

  setInterval(() => { tick().catch(err => console.error('tick error', err)); }, 60_000);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch(err => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
