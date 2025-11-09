export default async function handleScript({ runner, step }) {
  const result = await runner.evaluateOnPage(step.code);
  if (step.as) {
    runner.execution.setVar(step.as, result);
  }
}
