export default async function handleScroll({ automation, step }) {
  const { dy = 0, dx = 0 } = step.config ?? {};
  const deltaY = Number.isFinite(dy) ? dy : 0;
  const deltaX = Number.isFinite(dx) ? dx : 0;
  await automation.page.evaluate(({ deltaY, deltaX }) => {
    globalThis.scrollBy(deltaX, deltaY);
  }, { deltaY, deltaX });
}
