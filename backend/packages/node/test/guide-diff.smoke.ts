import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GuideDiffService } from '../src/guide/guide-diff.service';

function git(cwd: string, args: string[]) {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('  ✗ ' + msg);
    process.exitCode = 1;
  } else {
    console.log('  ✓ ' + msg);
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-diff-'));
git(root, ['init', '-q']);
git(root, ['config', 'user.email', 't@t.t']);
git(root, ['config', 'user.name', 't']);

const rel = 'orders.service.ts';
const before = `async refund(order: Order, amount: number) {
  order.status = 'refunded';
  await this.repo.save(order);
  return order;
}
`;
fs.writeFileSync(path.join(root, rel), before);
git(root, ['add', '.']);
git(root, ['commit', '-qm', 'base']);

// Edit: add a guard + ledger write.
const after = `async refund(order: Order, amount: number) {
  this.assertRefundable(order, amount);
  order.status = 'refunded';
  order.refundedAmount = amount;
  await this.repo.save(order);
  await this.ledger.record(order, amount);
  return order;
}
`;
fs.writeFileSync(path.join(root, rel), after);

const svc = new GuideDiffService();

console.log('edited function:');
const edited = svc.snapshot(root, rel, 'refund', 1, 'edited');
assert(edited.language === 'typescript', 'language detected as typescript');
assert(edited.before !== null && edited.after !== null, 'both panes present for edited');
assert(
  !!edited.after?.some((l) => l.kind === 'added' && l.text.includes('assertRefundable')),
  'after pane marks assertRefundable as added',
);
assert(
  !!edited.after?.some((l) => l.kind === 'context' && l.text.includes("status = 'refunded'")),
  'after pane keeps unchanged line as context',
);

console.log('added (untracked new file):');
const newRel = 'orders.controller.ts';
fs.writeFileSync(
  path.join(root, newRel),
  `@Post(':id/refund')\nasync refund(@Param('id') id: string) {\n  return this.orders.refund(id);\n}\n`,
);
const added = svc.snapshot(root, newRel, 'refund', 1, 'added');
assert(added.before === null, 'added → before is null');
assert(!!added.after && added.after.length >= 3, 'added → after has the new function body');

// focus mapping is exercised in the service; here we just confirm a snippet lands.
const afterTexts = (edited.after ?? []).map((l) => l.text);
const idx = afterTexts.findIndex((t) => t.includes('refundedAmount'));
assert(idx >= 0, 'focus snippet "refundedAmount" is locatable in after pane');

fs.rmSync(root, { recursive: true, force: true });
console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
