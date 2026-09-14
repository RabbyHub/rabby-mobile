import { parseMarkdown } from '@/components/Markdown/parseMarkdown';

export function hasMeaningfulChangelog(changelog: string) {
  const { success, blocks } = parseMarkdown(changelog);
  return (
    success &&
    blocks.some(block => {
      if (block.type === 'heading') {
        return false;
      }

      const texts =
        block.type === 'list'
          ? block.items.map(item => item.text)
          : [block.text];
      return texts.some(text => {
        const normalized = text.trim().replace(/\s+/g, ' ').replace(/\.+$/, '');
        return (
          !!normalized &&
          !/^fixed some bugs(?: and optimized (?:(?:some )?user experience|performance))?$/i.test(
            normalized,
          )
        );
      });
    })
  );
}
