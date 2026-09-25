/**
 * Requires `.alchemy/` to be git-ignored next to every stack file. `localState()` writes resource state,
 * outputs included, to `.alchemy/state` under the working directory the CLI runs from, which is the stack
 * file's directory for the default `alchemy.run.ts` entrypoint. Committed state leaks outputs and makes
 * every clone replay someone else's deployment.
 *
 * @attribution https://alchemy.run/state-store/ (inspiration; independently implemented)
 */
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";
import { alchemyStateIgnored } from "../gitignore.js";
import { stackFiles } from "../project-files.js";

const id = "alchemy-state-gitignored";
const docs = "https://alchemy.run/state-store/#local-state";

export const alchemyStateGitignored: ConformanceCheck = {
  id,
  description: "Every directory holding a stack file ignores .alchemy/ in a committed .gitignore.",
  docs,
  async run(options) {
    const files = await stackFiles(options);
    if (files.length === 0)
      return [
        {
          check: id,
          docs,
          severity: "error",
          evaluation: "failed",
          message: "No alchemy.run.ts under the project root. Set `stackFiles` to the stack entrypoints.",
        },
      ];
    const directories = [
      ...new Set(files.map((file) => path.posix.dirname(file)).map((dir) => (dir === "." ? "" : dir))),
    ];
    const evidence = await alchemyStateIgnored(options.root, directories);
    const findings: ConformanceFinding[] = [];
    for (const verdict of evidence.verdicts) {
      const where = verdict.directory === "" ? ".alchemy/" : `${verdict.directory}/.alchemy/`;
      const gitignore = verdict.directory === "" ? ".gitignore" : `${verdict.directory}/.gitignore`;
      if (verdict.tracked.length > 0)
        findings.push({
          check: id,
          docs,
          path: verdict.tracked[0],
          severity: "error",
          message: `${where} is committed (${verdict.tracked.length} file(s)). Remove it with \`git rm -r --cached ${where}\` and ignore it.`,
        });
      if (verdict.ignored) continue;
      findings.push({
        check: id,
        docs,
        path: gitignore,
        severity: "error",
        message:
          verdict.uncommittedSource === undefined
            ? `${where} is not git-ignored, so local Alchemy state can be committed. Add \`.alchemy/\` to ${gitignore} or the root .gitignore.`
            : `${where} is ignored only by ${verdict.uncommittedSource}, which is not committed. Add \`.alchemy/\` to ${gitignore} or the root .gitignore.`,
      });
    }
    return findings;
  },
};
