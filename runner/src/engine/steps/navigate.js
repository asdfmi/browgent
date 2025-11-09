export default async function handleNavigate({ runner, step }) {
  const waitUntil = step.waitUntil || 'load';
  await runner.page.goto(step.url, { waitUntil });
}
