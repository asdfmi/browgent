import { renderTemplate } from '../utils.js';

export default async function handleLog({ runner, step }) {
  const message = renderTemplate(step?.message ?? '', runner.execution);
  const entry = {
    type: 'log',
    target: step?.target || 'browgent',
    level: step?.level || 'info',
    message,
  };
  if (typeof runner.logger?.info === 'function') {
    runner.logger.info(message);
  } else if (typeof runner.logger?.log === 'function') {
    runner.logger.log(message);
  } else {
    console.log(message);
  }
  await runner.postEvent(runner.runId, entry);
  return false;
}
