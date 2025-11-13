import { DEFAULT_SUCCESS_TIMEOUT_SEC, renderTemplate } from "../utils.js";

export default async function handleFill({ automation, step }) {
  const {
    xpath = "",
    clear = false,
    timeout: timeoutSeconds = DEFAULT_SUCCESS_TIMEOUT_SEC,
  } = step.config ?? {};
  const value = renderTemplate(step.config.value, step.inputValues ?? {});
  const locator = automation.page.locator(`xpath=${xpath}`);
  const timeout = timeoutSeconds * 1000;
  if (clear) {
    await locator.fill("", { timeout });
  }
  await locator.fill(value, { timeout });
}
