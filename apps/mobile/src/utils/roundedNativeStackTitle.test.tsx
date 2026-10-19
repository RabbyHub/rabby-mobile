import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import { createRoundedNativeStackTitleAdapter } from './roundedNativeStackTitle';

// This unit test checks descriptor ownership and title props, not native glyphs
// or UINavigationBar transitions. Those require an iOS App visual check.
jest.mock('@react-navigation/elements', () => ({
  HeaderTitle: 'HeaderTitle',
}));

const roundedStyle = {
  fontFamily: 'ui-rounded',
  fontWeight: '800' as const,
  fontSize: 20,
};

function descriptor(options: NativeStackNavigationOptions) {
  return {
    options,
    route: { key: 'route', name: 'Route name' },
    render: jest.fn(),
  };
}

function titleElement(options: NativeStackNavigationOptions) {
  if (typeof options.headerTitle !== 'function') {
    throw new Error('Expected the rounded title renderer');
  }
  return options.headerTitle({
    children: options.title ?? 'Route name',
    tintColor: '#navigation-primary',
  }) as ReactElement<{
    children: string;
    style: typeof roundedStyle & { color?: string };
    tintColor?: string;
    allowFontScaling: boolean;
  }>;
}

describe('rounded native-stack title descriptors', () => {
  it('changes only the title renderer and keeps the native bar and controls', () => {
    const headerLeft = jest.fn();
    const headerRight = jest.fn();
    const original = descriptor({
      title: 'Assets',
      headerTitleStyle: [roundedStyle, { color: '#title' }],
      headerTintColor: '#buttons',
      headerLeft,
      headerRight,
      headerTransparent: true,
      headerBackVisible: true,
    });
    const adapted = createRoundedNativeStackTitleAdapter('ios')(original);
    const element = titleElement(adapted.options);

    expect(adapted).not.toBe(original);
    expect(adapted.route).toBe(original.route);
    expect(adapted.render).toBe(original.render);
    expect(adapted.options).toMatchObject({
      headerLeft,
      headerRight,
      headerTransparent: true,
      headerBackVisible: true,
      headerTitleStyle: {
        ...roundedStyle,
        fontFamily: 'System',
        color: '#title',
      },
    });
    expect(element.props).toMatchObject({
      children: 'Assets',
      tintColor: '#buttons',
      allowFontScaling: false,
      style: { ...roundedStyle, color: '#title' },
    });
    expect(original.options.headerTitle).toBeUndefined();
    expect(original.options.headerTitleStyle).toEqual([
      roundedStyle,
      { color: '#title' },
    ]);
  });

  it.each(['Custom label', ''])(
    'preserves the string title %j and native labels',
    title => {
      const adapted = createRoundedNativeStackTitleAdapter('ios')(
        descriptor({
          title: 'Different label',
          headerTitle: title,
          headerTitleStyle: roundedStyle,
        }),
      );
      expect(adapted.options.title).toBe(title);
      expect(titleElement(adapted.options).props.children).toBe(title);
    },
  );

  it('keeps the default title color instead of navigation button tint', () => {
    const adapted = createRoundedNativeStackTitleAdapter('ios')(
      descriptor({ headerTitleStyle: roundedStyle }),
    );
    expect(titleElement(adapted.options).props.children).toBe('Route name');
    expect(titleElement(adapted.options).props.tintColor).toBeUndefined();
  });

  it.each<NativeStackNavigationOptions>([
    {},
    { headerTitleStyle: { fontFamily: 'System', fontWeight: '900' } },
    { headerTitleStyle: roundedStyle, header: () => null },
    { headerTitleStyle: roundedStyle, headerLargeTitle: true },
    { headerTitleStyle: [roundedStyle, { fontFamily: 'System' }] },
  ])(
    'leaves unrelated or independently owned titles unchanged: %j',
    options => {
      const original = descriptor(options);
      expect(createRoundedNativeStackTitleAdapter('ios')(original)).toBe(
        original,
      );
    },
  );

  it('keeps an existing title renderer but sanitizes its unused native font', () => {
    const headerTitle = jest.fn(() => null);
    const original = descriptor({
      headerTitle,
      title: 'Custom title fallback',
      headerTitleStyle: roundedStyle,
    });
    const adapted = createRoundedNativeStackTitleAdapter('ios')(original);

    expect(adapted.options.headerTitle).toBe(headerTitle);
    expect(adapted.options.title).toBe('Custom title fallback');
    expect(adapted.options.headerTitleStyle).toEqual({
      ...roundedStyle,
      fontFamily: 'System',
    });
    expect(headerTitle).not.toHaveBeenCalled();
    expect(original.options.headerTitleStyle).toBe(roundedStyle);
  });

  it('leaves a hidden header untouched and adapts it when shown', () => {
    const adapt = createRoundedNativeStackTitleAdapter('ios');
    const hidden = descriptor({
      headerShown: false,
      headerTitleStyle: roundedStyle,
    });
    expect(adapt(hidden)).toBe(hidden);

    const shown = {
      ...hidden,
      options: { ...hidden.options, headerShown: true },
    };
    const adapted = adapt(shown);
    expect(adapted.options.headerTitleStyle).toEqual({
      ...roundedStyle,
      fontFamily: 'System',
    });
    expect(titleElement(adapted.options).props.style).toEqual(roundedStyle);
  });

  it('does not change Android descriptors', () => {
    const original = descriptor({ headerTitleStyle: roundedStyle });
    expect(createRoundedNativeStackTitleAdapter('android')(original)).toBe(
      original,
    );
  });

  it('adapts dynamically described or updated options without freezing updates', () => {
    const adapt = createRoundedNativeStackTitleAdapter('ios');
    const original = descriptor({
      title: 'Before',
      headerTitleStyle: roundedStyle,
    });
    const first = adapt(original);
    const updated = adapt({
      ...original,
      options: { ...original.options, title: 'After' },
    });
    expect(updated.options.headerTitle).not.toBe(first.options.headerTitle);
    expect(titleElement(updated.options).props.children).toBe('After');
    expect(titleElement(first.options).props.children).toBe('Before');
  });
});
