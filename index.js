require("dotenv").config();
const { Octokit } = require("@octokit/rest");

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  WAKATIME_ACCESS_TOKEN: wakatimeAccessToken
} = process.env;

async function main() {
  const missing = ["GIST_ID", "GH_TOKEN", "WAKATIME_ACCESS_TOKEN"].filter(
    name => !process.env[name] || !process.env[name].trim()
  );
  if (missing.length) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  let operation = "read WakaTime stats";
  try {
    const response = await fetch(
      "https://api.wakatime.com/api/v1/users/current/stats/last_7_days",
      {
        headers: { Authorization: `Bearer ${wakatimeAccessToken}` },
        redirect: "error",
        signal: AbortSignal.timeout(30000)
      }
    );
    if (response.status !== 200) {
      throw Object.assign(new Error(), { response });
    }
    const stats = await response.json();
    if (
      !stats ||
      !stats.data ||
      stats.data.is_up_to_date === false ||
      !Array.isArray(stats.data.languages) ||
      !stats.data.languages.every(
        language =>
          language &&
          typeof language.name === "string" &&
          typeof language.text === "string" &&
          Number.isFinite(language.percent) &&
          language.percent >= 0 &&
          language.percent <= 100
      )
    ) {
      throw new Error();
    }
    if (stats.data.languages.length === 0) return;

    operation = "get gist";
    const octokit = new Octokit({ auth: githubToken });
    const gist = await octokit.gists.get({ gist_id: gistId });
    operation = "update gist";
    await updateGist(stats, gist, octokit);
  } catch (error) {
    // Request errors can contain credentials in headers; log only the stage/status.
    const status =
      error.response && Number.isInteger(error.response.status)
        ? ` (HTTP ${error.response.status})`
        : "";
    console.error(`Unable to ${operation}${status}.`);
    process.exitCode = 1;
  }
}

function trimRightStr(str, len) {
  // Ellipsis takes 3 positions, so the index of substring is 0 to total length - 3.
  return str.length > len ? str.substring(0, len - 3) + "..." : str;
}

async function updateGist(stats, gist, octokit) {
  const lines = [];
  for (let i = 0; i < Math.min(stats.data.languages.length, 5); i++) {
    const data = stats.data.languages[i];
    const { name, percent, text: time } = data;

    const line = [
      trimRightStr(name, 10).padEnd(10),
      time.padEnd(14),
      generateBarChart(percent, 21),
      String(percent.toFixed(1)).padStart(5) + "%"
    ];

    lines.push(line.join(" "));
  }

  // Get original filename to update that same file
  const filename = Object.keys(gist.data.files)[0];
  if (!filename) throw new Error();
  await octokit.gists.update({
    gist_id: gistId,
    files: {
      [filename]: {
        filename: `📊 Weekly development breakdown`,
        content: lines.join("\n")
      }
    }
  });
}

function generateBarChart(percent, size) {
  const syms = "░▏▎▍▌▋▊▉█";

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);
  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }
  const semi = frac % 8;

  return [syms.substring(8, 9).repeat(barsFull), syms.substring(semi, semi + 1)]
    .join("")
    .padEnd(size, syms.substring(0, 1));
}

main();
