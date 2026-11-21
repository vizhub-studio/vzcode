import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PropertySection } from '../src/client/VZSidebar/VisualEditor/PropertySection';

describe('PropertySection', () => {
  it('renders an accessible expanded section by default', () => {
    const html = renderToStaticMarkup(
      createElement(PropertySection, { title: 'Appearance' }, 'Content'),
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Appearance');
    expect(html).toContain('Content');
    expect(html).toContain('aria-controls=');
  });

  it('hides collapsed content', () => {
    const html = renderToStaticMarkup(
      createElement(PropertySection, { title: 'Marks', initiallyOpen: false }, 'Secret'),
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Secret');
  });
});
