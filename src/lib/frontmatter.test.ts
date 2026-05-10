import { parseFrontmatter, serializeFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('returns empty meta and full content when no frontmatter block present', () => {
    const input = 'Just a plain body.';
    const result = parseFrontmatter(input);
    expect(result.meta).toEqual({});
    expect(result.body).toBe('Just a plain body.');
  });

  it('parses string fields', () => {
    const input = `---
title: My Task
status: in-progress
---
Body here.`;
    const result = parseFrontmatter(input);
    expect(result.meta.title).toBe('My Task');
    expect(result.meta.status).toBe('in-progress');
    expect(result.body).toBe('Body here.');
  });

  it('parses numeric fields', () => {
    const input = `---
sprint: 3
points: 5
---
`;
    const result = parseFrontmatter(input);
    expect(result.meta.sprint).toBe(3);
    expect(result.meta.points).toBe(5);
  });

  it('parses boolean fields', () => {
    const input = `---
techDebt: true
adr: false
---
`;
    const result = parseFrontmatter(input);
    expect(result.meta.techDebt).toBe(true);
    expect(result.meta.adr).toBe(false);
  });

  it('parses inline array fields', () => {
    const input = `---
tags: [auth, backend, api]
files: [src/auth.ts, src/middleware.ts]
---
`;
    const result = parseFrontmatter(input);
    expect(result.meta.tags).toEqual(['auth', 'backend', 'api']);
    expect(result.meta.files).toEqual(['src/auth.ts', 'src/middleware.ts']);
  });

  it('parses quoted string values', () => {
    const input = `---
title: "Hello, World"
branch: 'feature/my-branch'
---
`;
    const result = parseFrontmatter(input);
    expect(result.meta.title).toBe('Hello, World');
    expect(result.meta.branch).toBe('feature/my-branch');
  });

  it('strips leading/trailing whitespace from body', () => {
    const input = `---
title: Test
---

  Body with leading whitespace.
`;
    const result = parseFrontmatter(input);
    expect(result.body).toBe('Body with leading whitespace.');
  });

  it('handles empty body after frontmatter', () => {
    const input = `---
title: No body
---
`;
    const result = parseFrontmatter(input);
    expect(result.meta.title).toBe('No body');
    expect(result.body).toBe('');
  });

  it('handles empty frontmatter block', () => {
    const input = `---
---
Some content.`;
    const result = parseFrontmatter(input);
    expect(result.meta).toEqual({});
    expect(result.body).toBe('Some content.');
  });

  it('ignores malformed key lines without colon', () => {
    const input = `---
title: Good
not a key value pair
---
Body.`;
    const result = parseFrontmatter(input);
    expect(result.meta.title).toBe('Good');
    expect(result.body).toBe('Body.');
  });

  it('handles CRLF line endings', () => {
    const input = '---\r\ntitle: Windows\r\n---\r\nBody.';
    const result = parseFrontmatter(input);
    expect(result.meta.title).toBe('Windows');
    expect(result.body).toBe('Body.');
  });
});

describe('serializeFrontmatter', () => {
  it('produces a valid frontmatter block from a plain object', () => {
    const meta = { title: 'My Task', sprint: 3, status: 'planned' };
    const body = 'Task description.';
    const output = serializeFrontmatter(meta, body);
    const roundtrip = parseFrontmatter(output);
    expect(roundtrip.meta.title).toBe('My Task');
    expect(roundtrip.meta.sprint).toBe(3);
    expect(roundtrip.meta.status).toBe('planned');
    expect(roundtrip.body).toBe('Task description.');
  });

  it('serializes arrays inline', () => {
    const meta = { tags: ['auth', 'backend'] };
    const output = serializeFrontmatter(meta, '');
    const roundtrip = parseFrontmatter(output);
    expect(roundtrip.meta.tags).toEqual(['auth', 'backend']);
  });

  it('serializes booleans', () => {
    const meta = { techDebt: true, adr: false };
    const output = serializeFrontmatter(meta, '');
    const roundtrip = parseFrontmatter(output);
    expect(roundtrip.meta.techDebt).toBe(true);
    expect(roundtrip.meta.adr).toBe(false);
  });

  it('wraps string values containing a colon in quotes', () => {
    const meta = { title: 'feat: add auth' };
    const output = serializeFrontmatter(meta, '');
    expect(output).toContain('"feat: add auth"');
  });
});
