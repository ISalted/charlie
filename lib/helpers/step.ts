import { test } from "@playwright/test";

/**
 * `@step()` — wraps a POM method as a named step in the Playwright report.
 * Stage-3 decorator (see Playwright docs). Put it on EVERY public POM method.
 * Methods act-and-return; assertions stay in the test.
 */
export function step(label?: string) {
  return function <This, Args extends unknown[], Return>(
    target: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext,
  ) {
    return function (this: This, ...args: Args): Return {
      const name = label ?? `${(this as { constructor: { name: string } }).constructor.name}.${String(context.name)}`;
      return test.step(name, async () => target.call(this, ...args)) as Return;
    };
  };
}
