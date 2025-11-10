export default async function handleNavigate({ automation, step }) {
  const { url = '', waitUntil = 'load' } = step.config ?? {};
  await automation.page.goto(url, { waitUntil });
}
