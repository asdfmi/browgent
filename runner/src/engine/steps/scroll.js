export default async function handleScroll({ runner, step }) {
  const dy = Number.isFinite(step.dy) ? step.dy : 0;
  const dx = Number.isFinite(step.dx) ? step.dx : 0;
  await runner.page.evaluate(({ deltaY, deltaX }) => {
    globalThis.scrollBy(deltaX, deltaY);
  }, { deltaY: dy, deltaX: dx });
}
