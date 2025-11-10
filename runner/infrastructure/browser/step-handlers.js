import handleNavigate from './steps/navigate.js';
import handleWait from './steps/wait.js';
import handleScroll from './steps/scroll.js';
import handleClick from './steps/click.js';
import handleFill from './steps/fill.js';
import handlePress from './steps/press.js';
import handleLog from './steps/log.js';
import handleScript from './steps/script.js';
import handleExtractText from './steps/extractText.js';

export function createStepHandlerMap(overrides = {}) {
  const defaults = {
    navigate: handleNavigate,
    wait: handleWait,
    scroll: handleScroll,
    click: handleClick,
    fill: handleFill,
    press: handlePress,
    log: handleLog,
    script: handleScript,
    extract_text: handleExtractText,
  };
  return { ...defaults, ...overrides };
}
