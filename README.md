<p align="center">
  <img width="400" src="https://user-images.githubusercontent.com/4658208/60469862-2e40bf00-9c2c-11e9-87f7-afe164648de4.png">
  <h3 align="center">waka-box</h3>
  <p align="center">Update a pinned gist to contain your weekly WakaTime stats</p>
</p>

---

> 📌✨ For more pinned-gist projects like this one, check out: https://github.com/matchai/awesome-pinned-gists

## Setup

### Prep work

1. Create a new public GitHub Gist (https://gist.github.com/)
1. Create a token with the `gist` scope and copy it. (https://github.com/settings/tokens/new)
1. Create a WakaTime account (https://wakatime.com/signup)
1. Get a personal OAuth access token using the link in the [WakaTime authentication docs](https://wakatime.com/developers#authentication). It needs access to language statistics (`read_stats.languages` or `read_stats`). API keys are write-only and cannot be used to read these stats. Your WakaTime profile does not need to be public.

### Project setup

1. Fork this repo
1. Go to the repo **Settings > Secrets and variables > Actions**
1. Add the following repository secrets:
   - **GIST_ID:** The ID portion from your gist url: `https://gist.github.com/matchai/`**`6d5f84419863089a167387da62dd7081`**.
   - **GH_TOKEN:** The GitHub token generated above.
   - **WAKATIME_API_KEY:** The personal OAuth access token for your WakaTime account, stored under the existing secret name. The workflow maps it to the internal `WAKATIME_ACCESS_TOKEN` environment variable and sends it only in the `Authorization: Bearer` header.

### Migrating an existing fork

1. Replace the value of the existing repository secret `WAKATIME_API_KEY` with the personal OAuth access token. Keep the secret name unchanged; no new or renamed secret is needed.
1. Deploy the source, `dist/index.js`, `action.yml`, and workflow changes together to the default branch. The workflow uses `./` to run this repository's bundled action instead of `matchai/waka-box@master`.
1. Run **Update gist with WakaTime stats** manually and check the result and Gist. The automatic schedule remains daily at **00:17 UTC**.

Missing configuration, failed WakaTime/Gist requests, and invalid or unfinished stats fail the action. Error logs contain the failing stage and HTTP status when available, never request headers or response bodies. Empty language stats leave the Gist unchanged. Replace the secret if the token expires or is revoked.

### Development

Use Node.js 24, matching `action.yml`. For local runs, `sample.env` uses the program's internal `WAKATIME_ACCESS_TOKEN` environment variable; the GitHub repository secret remains named `WAKATIME_API_KEY`.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

Commit `dist/index.js` with source changes: GitHub Actions runs the bundle directly. Tests use fake credentials and mocked HTTP requests for both the source and the bundle; they do not contact WakaTime or update a real Gist. Keep real credentials in GitHub Actions secrets or an ignored local `.env` file, never in source or logs.
