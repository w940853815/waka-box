const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const cases = [
  ["success", 0, ""],
  ["empty", 0, ""],
  [
    "missing",
    1,
    "Missing required environment variables: WAKATIME_ACCESS_TOKEN"
  ],
  ["blank", 1, "Missing required environment variables: WAKATIME_ACCESS_TOKEN"],
  ["missing-gist", 1, "Missing required environment variables: GIST_ID"],
  ["missing-github", 1, "Missing required environment variables: GH_TOKEN"],
  ...[202, 301, 401, 403, 429, 500].map(status => [
    `read-${status}`,
    1,
    `Unable to read WakaTime stats (HTTP ${status}).`
  ]),
  ...["network", "json", "invalid", "invalid-language", "stale"].map(kind => [
    `read-${kind}`,
    1,
    "Unable to read WakaTime stats."
  ]),
  ["get-404", 1, "Unable to get gist (HTTP 404)."],
  ["get-network", 1, "Unable to get gist."],
  ["gist-empty", 1, "Unable to update gist."],
  ["update-403", 1, "Unable to update gist (HTTP 403)."],
  ["update-500", 1, "Unable to update gist (HTTP 500)."],
  ["update-network", 1, "Unable to update gist."]
];

for (const entry of ["index.js", "dist/index.js"]) {
  for (const [scenario, exitCode, message] of cases) {
    test(`${entry}: ${scenario}`, () => {
      // An empty working directory and explicit environment exclude local secrets.
      const cwd = mkdtempSync(path.join(tmpdir(), "waka-box-test-"));
      try {
        const result = spawnSync(
          process.execPath,
          [
            "--require",
            path.join(__dirname, "mock-http.js"),
            path.join(__dirname, "..", entry)
          ],
          {
            cwd,
            timeout: 10000,
            encoding: "utf8",
            env: {
              TEST_SCENARIO: scenario,
              GIST_ID: scenario === "missing-gist" ? "" : "test-gist",
              GH_TOKEN:
                scenario === "missing-github" ? "" : "github-test-canary",
              WAKATIME_ACCESS_TOKEN:
                scenario === "missing"
                  ? ""
                  : scenario === "blank"
                  ? "   "
                  : "oauth-test-canary"
            }
          }
        );
        assert.ifError(result.error);
        assert.equal(result.status, exitCode, result.stderr);
        assert.equal(result.stdout, "");
        assert.doesNotMatch(result.stdout + result.stderr, /test-canary/);
        // ncc eagerly loads Octokit's legacy fetch fallback on Node 24.
        const stderr = result.stderr.replace(
          /^\(node:\d+\) \[DEP0040\] DeprecationWarning: The `punycode` module is deprecated\. Please use a userland alternative instead\.\n\(Use `node --trace-deprecation \.\.\.` to show where the warning was created\)\n/gm,
          ""
        );
        assert.equal(stderr.trim(), message);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    });
  }
}

test("workflow keeps the existing secret and schedule for the local action", () => {
  const workflow = readFileSync(
    path.join(__dirname, "../.github/workflows/schedule.yml"),
    "utf8"
  );
  const action = readFileSync(path.join(__dirname, "../action.yml"), "utf8");
  assert.match(workflow, /uses: \.\//);
  assert.match(workflow, /cron: "17 0 \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(
    workflow,
    /WAKATIME_ACCESS_TOKEN: \$\{\{ secrets\.WAKATIME_API_KEY \}\}/
  );
  assert.doesNotMatch(
    workflow,
    /matchai\/waka-box|secrets\.WAKATIME_ACCESS_TOKEN/
  );
  assert.match(action, /using: "node24"/);
  assert.match(action, /main: "dist\/index.js"/);
});
