export default async function handleScript({ automation, execution, step }) {
  const { code = '', as = null } = step.config ?? {};
  const result = await automation.evaluateOnPage(code, execution.getVariablesSnapshot());
  if (as) {
    execution.setVar(as, result);
  }
}
