/**
 * Mock "narrated playback" guide — the v2 shape the codemap-guide skill will
 * author and the backend will snapshot from git. No voice yet: narration is
 * text + per-sentence focus directives that the GuidePlayer animates.
 *
 * Line indices in `focus.lines` are 0-based and inclusive, addressing the
 * `before`/`after` line arrays on the same step's diff.
 */

export type DiffSide = "before" | "after" | "both";

/** One spoken sentence and the change area it should focus while "speaking". */
export type NarrationSegment = {
  text: string;
  /** What to highlight while this sentence plays. Omit to highlight nothing. */
  focus?: { side: DiffSide; lines: [number, number] };
};

/** A unified line in a diff pane — drives added/removed coloring. */
export type DiffLine = {
  text: string;
  kind: "added" | "removed" | "context";
};

export type StepDiff = {
  language: string;
  /** Null when the function is brand new (changeType "added"). */
  before: DiffLine[] | null;
  /** Null when the function was deleted (changeType "removed"). */
  after: DiffLine[] | null;
};

export type PlayableGuideStep = {
  nodeId: string;
  funcName: string;
  file: string;
  changeType: "added" | "edited" | "removed";
  diff: StepDiff;
  narration: NarrationSegment[];
};

export type PlayableGuide = {
  title: string;
  slug: string;
  steps: PlayableGuideStep[];
};

const ctx = (text: string): DiffLine => ({ text, kind: "context" });
const add = (text: string): DiffLine => ({ text, kind: "added" });

export const MOCK_GUIDE: PlayableGuide = {
  title: "Refund flow",
  slug: "refund-flow",
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
          text: "The service's refund method is where the new safety check lives.",
          focus: { side: "after", lines: [0, 0] },
        },
        {
          text: "Before touching anything, it now asserts the order can actually be refunded for this amount.",
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
