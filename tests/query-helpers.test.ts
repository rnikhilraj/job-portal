import { buildPageHref, firstValue, toQueryRecord } from '@/lib/query';

describe('search param normalisation', () => {
  it('collapses a repeated param to its first value', () => {
    // Without this, `?q=a&q=b` would hand an array to a schema expecting a string.
    expect(firstValue(['a', 'b'])).toBe('a');
    expect(firstValue('a')).toBe('a');
  });

  it('drops empty and missing values', () => {
    expect(toQueryRecord({ q: '', location: undefined, jobType: 'REMOTE' })).toEqual({
      jobType: 'REMOTE',
    });
  });
});

describe('buildPageHref', () => {
  it('keeps the active filters and replaces the page', () => {
    const href = buildPageHref('/jobs', { q: 'react', location: 'Remote', page: '1' }, 3);
    const url = new URL(href, 'http://localhost');

    expect(url.pathname).toBe('/jobs');
    expect(url.searchParams.get('q')).toBe('react');
    expect(url.searchParams.get('location')).toBe('Remote');
    expect(url.searchParams.get('page')).toBe('3');
  });

  it('omits page=1 so the first page has a clean URL', () => {
    expect(buildPageHref('/jobs', { q: 'react' }, 1)).toBe('/jobs?q=react');
    expect(buildPageHref('/jobs', {}, 1)).toBe('/jobs');
  });
});
