/**
 * Centralised process / environment access.
 *
 * This is the only module in the package that may touch `process.*`.
 */

import { Context, Layer } from "effect";

export class Env extends Context.Service<
  Env,
  {
    /** Current working directory, captured at startup. */
    readonly cwd: string;
    /** CLI arguments excluding node and script path. */
    readonly argv: ReadonlyArray<string>;
    /** Set the process exit code (non-zero signals failure to the shell). */
    setExitCode(code: number): void;
  }
>()("oio/Env") {
  static readonly layer: Layer.Layer<Env> = Layer.sync(Env, () =>
    Env.of({
      cwd: process.cwd(),
      argv: process.argv.slice(2),
      setExitCode: (code) => {
        process.exitCode = code;
      },
    }),
  );
}
