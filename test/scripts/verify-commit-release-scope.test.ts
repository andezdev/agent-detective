import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  DOC_ONLY_PATHS,
  isDocOnlyPath,
  parseCommitType,
  verifyCommitReleaseScope,
} from '../../scripts/verify-commit-release-scope.js';

describe('verify-commit-release-scope', () => {
  it('detects doc-only paths', () => {
    assert.ok(isDocOnlyPath('docs/operator/get-started.md'));
    assert.ok(isDocOnlyPath('apps/landing/src/i18n/strings.ts'));
    assert.ok(isDocOnlyPath('README.md'));
    assert.ok(!isDocOnlyPath('src/cli/init.ts'));
    assert.ok(!isDocOnlyPath('packages/sdk/package.json'));
  });

  it('parses conventional commit types', () => {
    assert.equal(parseCommitType('feat(cli): add init'), 'feat');
    assert.equal(parseCommitType('fix(docs): typo'), 'fix');
    assert.equal(parseCommitType('docs: update readme'), 'docs');
  });

  it('rejects releasable types for docs-only file sets', () => {
    const files = ['docs/operator/get-started.md', 'apps/docs/src/content/docs/index.mdx'];
    const err = verifyCommitReleaseScope('fix(docs): link', 'fix(docs): link', files);
    assert.ok(err?.includes('docs/landing only'));
  });

  it('allows docs: for docs-only file sets', () => {
    const files = ['docs/operator/get-started.md'];
    assert.equal(verifyCommitReleaseScope('docs: tweak copy', 'docs: tweak copy', files), undefined);
  });

  it('allows fix: when runtime files change', () => {
    const files = ['docs/operator/get-started.md', 'src/cli/init.ts'];
    assert.equal(
      verifyCommitReleaseScope('fix(cli): init path', 'fix(cli): init path', files),
      undefined,
    );
  });

  it('treats breaking changes as releasable', () => {
    const files = ['README.md'];
    assert.ok(
      verifyCommitReleaseScope('feat!: drop binary', 'feat!: drop binary\n\nBREAKING CHANGE: x', files),
    );
  });

  it('exports doc-only path list for release-please parity', () => {
    assert.ok(DOC_ONLY_PATHS.some((p) => p.startsWith('docs')));
  });
});
