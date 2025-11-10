import { renderTemplate } from '../utils.js';

export default async function handleLog({ execution, step, logger, publishEvent, runId }) {
  const { message: template = '', target = 'agent-flow', level = 'info' } = step.config ?? {};
  const message = renderTemplate(template, execution);
  const entry = {
    type: 'log',
    target,
    level,
    message,
  };
  if (typeof logger?.info === 'function') {
    logger.info(message);
  } else if (typeof logger?.log === 'function') {
    logger.log(message);
  } else {
    console.log(message);
  }
  if (typeof publishEvent === 'function') {
    await publishEvent(runId, entry);
  }
  return false;
}
