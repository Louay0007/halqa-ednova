import { TfIdfIndex, rewriteQuery, tokenize } from '../../src/ai/retrieval/tfidf';

function seeded(): TfIdfIndex {
  const idx = new TfIdfIndex();
  idx.addDoc('bs-en-01', 'Binary search halves a sorted array each step to find a target', 'en', 'intro', ['needs-sorted']);
  idx.addDoc('bs-fr-01', 'La recherche dichotomique divise un tableau trie en deux', 'fr', 'intro', ['needs-sorted']);
  idx.addDoc('frac-en-01', 'A fraction compares parts of a whole with numerator and denominator', 'en', 'intro', ['parts WHOLE']);
  return idx;
}

describe('tfidf (pure)', () => {
  it('ranks the relevant doc first', () => {
    const hits = seeded().search('binary search sorted array', 'en', 5);
    expect(hits[0].id).toBe('bs-en-01');
    expect(hits[0].claims).toEqual(['needs-sorted']); // service attaches cites from claims
  });
  it('applies the session-lang boost (+0.15) to break near-ties', () => {
    const idx = new TfIdfIndex();
    idx.addDoc('doc-en', 'shared vocabulary terms here', 'en', 'intro');
    idx.addDoc('doc-fr', 'shared vocabulary terms here', 'fr', 'intro');
    // identical lexical scores → session lang decides
    expect(idx.search('shared vocabulary terms', 'en', 5)[0].id).toBe('doc-en');
    expect(idx.search('shared vocabulary terms', 'fr', 5)[0].id).toBe('doc-fr');
    // and the fr doc still wins an fr-leaning query in an fr session
    expect(seeded().search('tableau trie binary search', 'fr', 5)[0].id).toBe('bs-fr-01');
  });
  it('is deterministic with id tiebreak', () => {
    const idx = new TfIdfIndex();
    idx.addDoc('b-doc', 'same words here', 'en', 'intro');
    idx.addDoc('a-doc', 'same words here', 'en', 'intro');
    const hits = idx.search('same words here', 'en', 5);
    expect(hits.map((h) => h.id)).toEqual(['a-doc', 'b-doc']);
  });
  it('returns [] on empty index or empty query', () => {
    expect(new TfIdfIndex().search('anything', 'en')).toEqual([]);
    expect(seeded().search('   ', 'en')).toEqual([]);
  });
  it('rewriteQuery yields 3 deterministic variants', () => {
    expect(rewriteQuery('sorted array?', 'intro')).toEqual([
      'sorted array?',
      'sorted array? intro',
      'sorted array? example',
    ]);
  });
  it('tokenize strips diacritics and short tokens', () => {
    expect(tokenize('École a sorted-array!')).toEqual(['ecole', 'sorted', 'array']);
  });
});
