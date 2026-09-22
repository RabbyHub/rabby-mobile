/** Release authors opt in to automatic prompts with an HTML comment. */
export function parseUpgradeChangelog(markdown: string) {
  let autoPrompt = false;
  const changelog = markdown.replace(
    /<!--\s*rabby:auto-prompt\s*=\s*(on|off)\s*-->/gi,
    (_, value: string) => {
      autoPrompt = value.toLowerCase() === 'on';
      return '';
    },
  );

  return { autoPrompt, changelog: changelog.trim() };
}
