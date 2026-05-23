import * as fs from 'fs';
import * as path from 'path';

import { GuideException } from '../exceptions/flow-mapper.exceptions';
import { GUIDE_SAVE_DIR, GUIDE_SLUG_PATTERN } from '../constants';
import { GuideArtifact } from '../dto/flow-mapper-config.dto';

/**
 * Loads skill-authored guides from `.codemap/guides`. code-map plays guides; it
 * no longer generates them — authoring is the codemap-guide skill's job, driven
 * by the conversation rather than a git diff.
 */
export class GuideService {
  /** Read a saved guide from `.codemap/guides/<slug>.json`. */
  loadSaved(repoRoot: string, slug: string): GuideArtifact {
    if (!GUIDE_SLUG_PATTERN.test(slug)) {
      throw new GuideException(slug, 'invalid guide slug');
    }
    const file = path.join(repoRoot, GUIDE_SAVE_DIR, `${slug}.json`);
    if (!fs.existsSync(file)) {
      throw new GuideException(slug, 'guide not found');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new GuideException(slug, `invalid guide JSON: ${(err as Error).message}`);
    }
    if (!parsed || !Array.isArray((parsed as GuideArtifact).steps)) {
      throw new GuideException(slug, 'guide is missing a steps array');
    }
    return parsed as GuideArtifact;
  }

  /** List available saved guide slugs under `.codemap/guides`. */
  listSaved(repoRoot: string): string[] {
    const dir = path.join(repoRoot, GUIDE_SAVE_DIR);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length));
  }
}
