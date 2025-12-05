import { ReactotronCore } from 'reactotron-core-client';

type DisplayConfig = Parameters<ReactotronCore['display']>[0];

export const log2Reactotron = (
  reactotron: ReactotronCore,
  { name, value, preview, image, important }: Partial<DisplayConfig>,
) => {
  reactotron.display({
    name: name || 'RabbyMobile',
    value,
    preview,
    image,
    important: important ?? true,
  });
};
