/**
 * Mock "narrated playback" guide — a hand-written sample in the same shape the
 * backend now produces, used by the `?guidemock=1` preview. Types + the
 * artifact adapter live in `guide-playable.ts`.
 */
import type { DiffLine, PlayableGuide } from "./guide-playable";

const ctx = (text: string): DiffLine => ({ text, kind: "context" });
const add = (text: string): DiffLine => ({ text, kind: "added" });

export const MOCK_GUIDE: PlayableGuide = {
  title: "Refund flow",
  slug: "refund-flow",
  summary: "Adds a refund endpoint that validates the order and records the amount before refunding.",
  closing: "So a refund now flows controller → service → guard, validated and logged end to end — no more silent status flips.",
  overview: {
    before: [
      "Refunds were a one-liner: the service just flipped an order's status to 'refunded'.",
      "Nothing validated whether the order could actually be refunded, and no money trail was recorded.",
    ],
    change: [
      "This change adds a real refund endpoint that loads the order and delegates to the service.",
      "The service now guards the operation and writes a ledger entry, so refunds are validated and traceable.",
    ],
  },
  steps: [
    {
      nodeId: "src/orders/orders.controller.ts:OrdersController#refund",
      funcName: "refund",
      file: "src/orders/orders.controller.ts",
      changeType: "added",
      diff: {
        language: "typescript",
        before: null,
        after: [
          add("@Post(':id/refund')"),
          add("async refund("),
          add("  @Param('id') id: string,"),
          add("  @Body() dto: RefundDto,"),
          add(") {"),
          add("  const order = await this.orders.findOne(id);"),
          add("  return this.orders.refund(order, dto.amount);"),
          add("}"),
        ],
      },
      narration: [
        {
          text: "Heads up: order lookup and the payment gateway live in code we didn't touch here.",
        },
        {
          text: "We start at the new refund endpoint on the orders controller.",
          focus: { side: "after", lines: [0, 1] },
        },
        {
          text: "It reads the order id from the route and the amount from the request body.",
          focus: { side: "after", lines: [2, 4] },
        },
        {
          text: "Then it loads the order and hands the real work off to the service.",
          focus: { side: "after", lines: [5, 6] },
        },
      ],
    },
    {
      nodeId: "src/orders/orders.service.ts:OrdersService#refund",
      funcName: "refund",
      file: "src/orders/orders.service.ts",
      changeType: "edited",
      diff: {
        language: "typescript",
        before: [
          ctx("async refund(order: Order, amount: number) {"),
          ctx("  order.status = 'refunded';"),
          ctx("  await this.repo.save(order);"),
          ctx("  return order;"),
          ctx("}"),
        ],
        after: [
          ctx("async refund(order: Order, amount: number) {"),
          add("  this.assertRefundable(order, amount);"),
          add(""),
          ctx("  order.status = 'refunded';"),
          add("  order.refundedAmount = amount;"),
          ctx("  await this.repo.save(order);"),
          add("  await this.ledger.record(order, amount);"),
          ctx("  return order;"),
          ctx("}"),
        ],
      },
      narration: [
        {
          text: "Before, refunding was a one-liner: it just flipped the status and saved the order.",
          focus: { side: "before", lines: [1, 2] },
        },
        {
          text: "Now, before touching anything, it asserts the order can actually be refunded for this amount.",
          focus: { side: "after", lines: [1, 1] },
        },
        {
          text: "It records the refunded amount on the order so partial refunds are tracked.",
          focus: { side: "after", lines: [4, 4] },
        },
        {
          text: "And finally it writes a ledger entry, which the old version never did.",
          focus: { side: "after", lines: [6, 6] },
        },
      ],
    },
    {
      nodeId: "src/orders/orders.service.ts:OrdersService#assertRefundable",
      funcName: "assertRefundable",
      file: "src/orders/orders.service.ts",
      changeType: "added",
      diff: {
        language: "typescript",
        before: null,
        after: [
          add("private assertRefundable(order: Order, amount: number) {"),
          add("  if (order.status !== 'paid') {"),
          add("    throw new OrderNotRefundableException(order.id);"),
          add("  }"),
          add("  if (amount > order.total) {"),
          add("    throw new RefundExceedsTotalException(order.id, amount);"),
          add("  }"),
          add("}"),
        ],
      },
      narration: [
        {
          text: "Here's the guard itself — a small private helper.",
          focus: { side: "after", lines: [0, 0] },
        },
        {
          text: "It rejects anything that isn't in the paid state with a specific exception.",
          focus: { side: "after", lines: [1, 3] },
        },
        {
          text: "And it refuses refunds larger than the order total, naming the offending amount.",
          focus: { side: "after", lines: [4, 6] },
        },
      ],
    },
  ],
};
