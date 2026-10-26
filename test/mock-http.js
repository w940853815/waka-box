const assert = require("node:assert/strict");

const scenario = process.env.TEST_SCENARIO;
const calls = [];
const languages = [
  { name: "TypeScript", percent: 50.04, text: "5 hrs 1 min" },
  { name: "VeryLongLanguage", percent: 25, text: "2 hrs" },
  { name: "Rust", percent: 100, text: "1 hr" },
  { name: "Go", percent: 0, text: "0 secs" },
  { name: "Python", percent: 1, text: "1 min" },
  { name: "Sixth", percent: 0, text: "0 secs" }
];

function blockNetwork() {
  throw new Error("Unexpected real network request");
}
require("node:net").Socket.prototype.connect = blockNetwork;
require("node:http").request = blockNetwork;
require("node:https").request = blockNetwork;

// Both native WakaTime fetch and the bundled Octokit transport use this mock.
global.fetch = async (url, options) => {
  if (new URL(url).hostname === "api.wakatime.com") {
    calls.push("stats");
    assert.equal(
      url,
      "https://api.wakatime.com/api/v1/users/current/stats/last_7_days"
    );
    assert.deepEqual(options.headers, {
      Authorization: "Bearer oauth-test-canary"
    });
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    if (scenario === "read-network") {
      throw new Error("timeout: oauth-test-canary");
    }
    const match = /^read-(\d+)$/.exec(scenario);
    const status = match ? Number(match[1]) : 200;
    let payload = { data: { languages } };
    if (status !== 200) payload = { error: "oauth-test-canary" };
    if (scenario === "empty") payload.data.languages = [];
    if (scenario === "read-invalid") payload = { error: "oauth-test-canary" };
    if (scenario === "read-invalid-language") payload.data.languages = [null];
    if (scenario === "read-stale") payload.data.is_up_to_date = false;
    return new Response(
      scenario === "read-json" ? "oauth-test-canary" : JSON.stringify(payload),
      { status }
    );
  }

  assert.equal(url, "https://api.github.com/gists/test-gist");
  assert.equal(
    new Headers(options.headers).get("authorization"),
    "token github-test-canary"
  );
  const updating = options.method === "PATCH";
  assert.equal(options.method, updating ? "PATCH" : "GET");
  const operation = updating ? "update" : "get";
  calls.push(operation);
  if (updating) {
    assert.deepEqual(JSON.parse(options.body), {
      files: {
        "original.txt": {
          filename: "📊 Weekly development breakdown",
          content: [
            "TypeScript 5 hrs 1 min    ██████████▌░░░░░░░░░░  50.0%",
            "VeryLon... 2 hrs          █████▎░░░░░░░░░░░░░░░  25.0%",
            "Rust       1 hr           █████████████████████ 100.0%",
            "Go         0 secs         ░░░░░░░░░░░░░░░░░░░░░   0.0%",
            "Python     1 min          ▏░░░░░░░░░░░░░░░░░░░░   1.0%"
          ].join("\n")
        }
      }
    });
  }
  if (scenario === `${operation}-network`) {
    throw new Error("network: github-test-canary");
  }
  const match = new RegExp(`^${operation}-(\\d+)$`).exec(scenario);
  const status = match ? Number(match[1]) : 200;
  const payload =
    status !== 200
      ? { message: "github-test-canary" }
      : {
          files:
            scenario === "gist-empty"
              ? {}
              : { "original.txt": {}, "unrelated.txt": {} }
        };
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
};

process.on("exit", () => {
  const expected =
    scenario.startsWith("missing") || scenario === "blank"
      ? []
      : scenario.startsWith("read-") || scenario === "empty"
      ? ["stats"]
      : scenario.startsWith("get-") || scenario === "gist-empty"
      ? ["stats", "get"]
      : ["stats", "get", "update"];
  assert.deepEqual(calls, expected);
});
