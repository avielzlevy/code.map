import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { GuideService } from '../src/guide/guide.service';
import { FlowGraph } from '../src/dto/code-map-config.dto';

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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-author-'));
git(root, ['init', '-q']);
git(root, ['config', 'user.email', 't@t.t']);
git(root, ['config', 'user.name', 't']);

const rel = 'src/orders/orders.service.ts';
fs.mkdirSync(path.join(root, 'src/orders'), { recursive: true });
fs.writeFileSync(
  path.join(root, rel),
  `async refund(order: Order, amount: number) {\n  order.status = 'refunded';\n  await this.repo.save(order);\n  return order;\n}\n`,
);
git(root, ['add', '.']);
git(root, ['commit', '-qm', 'base']);
fs.writeFileSync(
  path.join(root, rel),
  `async refund(order: Order, amount: number) {\n  this.assertRefundable(order, amount);\n  order.status = 'refunded';\n  order.refundedAmount = amount;\n  await this.repo.save(order);\n  return order;\n}\n`,
);

const absFile = path.join(root, rel);
const graph: FlowGraph = {
  generatedAt: new Date().toISOString(),
  nodes: [
    {
      id: `${absFile}:OrdersService#refund`,
      label: 'refund',
      methodName: 'refund',
      type: 'service',
      filePath: absFile,
      lineNumber: 1,
      rawBody: '',
    },
  ],
  edges: [],
};

const svc = new GuideService();
const { artifact, unresolved } = svc.author(graph, root, {
  slug: 'refund-flow',
  title: 'Refund flow',
  steps: [
    {
      methodName: 'refund',
      file: 'orders.service.ts',
      changeType: 'edited',
      narration: [
        { text: 'It now asserts the order can be refunded.', focus: 'assertRefundable' },
        { text: 'And records the refunded amount.', focus: 'order.refundedAmount = amount' },
      ],
    },
  ],
});

assert(unresolved.length === 0, 'no unresolved steps');
assert(artifact.steps.length === 1, 'one resolved step');
const step = artifact.steps[0];
assert(step.file === rel, `file is repo-relative (${step.file})`);
assert(step.nodeId === `${rel}:OrdersService#refund`, `nodeId relativized (${step.nodeId})`);
assert(step.diff.after !== null && step.diff.before !== null, 'diff has both panes');
assert(step.narration.length === 2, 'two narration sentences');

const f0 = step.narration[0].focus;
const afterLine = f0 && step.diff.after ? step.diff.after[f0.lines[0]].text : '';
assert(!!f0 && f0.side === 'after', 'sentence 1 focus resolved to after pane');
assert(afterLine.includes('assertRefundable'), `focus 1 lands on the right line (${afterLine.trim()})`);

const f1 = step.narration[1].focus;
const afterLine1 = f1 && step.diff.after ? step.diff.after[f1.lines[0]].text : '';
assert(!!f1 && afterLine1.includes('refundedAmount'), `focus 2 lands on refundedAmount (${afterLine1.trim()})`);

assert(step.explanation === step.narration[0].text, 'legacy explanation mirrors narration[0]');

fs.rmSync(root, { recursive: true, force: true });
console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
