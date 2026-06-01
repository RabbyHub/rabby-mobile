import React from 'react';

jest.mock('@/components/Text', () => ({
  Text: 'Text',
}));

import { renderNode, renderText } from './renderNode';

const Box = 'Box' as unknown as React.FC<any>;

describe('renderNode', () => {
  it('returns null for empty-like content', () => {
    expect(renderNode(Box, null)).toBeNull();
    expect(renderNode(Box, false)).toBeNull();
    expect(renderNode(Box, '')).toBeNull();
  });

  it('returns existing React elements and function results unchanged', () => {
    const element = <Box testID="existing" />;
    const fromFunction = <Box testID="from-function" />;

    expect(renderNode(Box, element)).toBe(element);
    expect(renderNode(Box, () => fromFunction)).toBe(fromFunction);
  });

  it('renders boolean true, string, number, and bigint values as children', () => {
    expect(renderNode(Box, true, { role: 'empty' })).toMatchObject({
      type: Box,
      props: { role: 'empty' },
    });
    expect(renderNode(Box, 'hello', { role: 'text' })).toMatchObject({
      type: Box,
      props: { children: 'hello', role: 'text' },
    });
    expect(renderNode(Box, 42, { role: 'number' })).toMatchObject({
      type: Box,
      props: { children: 42, role: 'number' },
    });
    expect(renderNode(Box, 42n, { role: 'bigint' })).toMatchObject({
      type: Box,
      props: { children: 42n, role: 'bigint' },
    });
  });

  it('merges object content over default props', () => {
    expect(
      renderNode(
        Box,
        {
          role: 'content',
          value: 1,
        },
        {
          role: 'default',
          testID: 'box',
        },
      ),
    ).toMatchObject({
      type: Box,
      props: {
        role: 'content',
        testID: 'box',
        value: 1,
      },
    });
  });

  it('renders text with flattened caller and default styles', () => {
    expect(
      renderText(
        'hello',
        {
          numberOfLines: 1,
          style: {
            color: 'red',
          },
        },
        {
          fontSize: 12,
        },
      ),
    ).toMatchObject({
      type: 'Text',
      props: {
        children: 'hello',
        numberOfLines: 1,
        style: {
          color: 'red',
          fontSize: 12,
        },
      },
    });
  });
});
