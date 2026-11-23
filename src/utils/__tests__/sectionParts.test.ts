import { describe, expect, it } from 'vitest';
import { addPart, cleanParts, partsText, readParts, resolveParts } from '../../types/sectionParts';

describe('section parts', () => {
  it('a section with no parts (or one) reads as a single page', () => {
    expect(resolveParts('<p>Main</p>', [])).toEqual([]);
    expect(resolveParts('<p>Main</p>', null)).toEqual([]);
    expect(resolveParts('<p>Main</p>', [{ id: 'main', title: 'Only', html: '' }])).toEqual([]);
  });

  it('adding the first part turns the section\'s own text into Part 1', () => {
    const parts = addPart([]);
    expect(parts).toHaveLength(2);
    expect(parts[0].id).toBe('main');
  });

  it('Part 1 shows the section\'s own text; the others show theirs; missing titles become "Part N"', () => {
    const parts = [{ id: 'main', title: 'Intro', html: '' }, { id: 'a', title: '', html: '<p>Two</p>' }];
    expect(resolveParts('<p>Main</p>', parts)).toEqual([
      { id: 'main', title: 'Intro', html: '<p>Main</p>' },
      { id: 'a', title: 'Part 2', html: '<p>Two</p>' },
    ]);
  });

  it('saving drops empty extra parts, and no real extra part means no parts at all', () => {
    const blank = [{ id: 'main', title: 'Intro', html: '' }, { id: 'a', title: 'Empty', html: '<p><br></p>' }];
    expect(cleanParts(blank)).toEqual([]);
    const some = [...blank, { id: 'b', title: ' Three ', html: '<p>Text</p>' }];
    expect(cleanParts(some).map((p) => p.id)).toEqual(['main', 'b']);
    expect(cleanParts(some)[1].title).toBe('Three');
  });

  it('keeps a part that only holds a picture or a table', () => {
    const p = [{ id: 'main', title: '', html: '' }, { id: 'a', title: 'Plan', html: '<p><img src="x.png"></p>' }];
    expect(cleanParts(p)).toHaveLength(2);
  });

  it('survives rubbish stored values and gives the AI the text of the extra parts', () => {
    expect(readParts('nope')).toEqual([]);
    expect(readParts([null, 5, { title: 'x' }])).toHaveLength(1);
    const parts = [{ id: 'main', title: 'A', html: '' }, { id: 'b', title: 'B', html: '<p>Body</p>' }];
    expect(partsText(parts, (h) => h.replace(/<[^>]*>/g, ''))).toBe('B\nBody');
  });
});
