# Deploying to Netlify

The project is configured through `netlify.toml` to run `npm run build` and
publish the generated `dist/public` directory.

Netlify project: <https://gleaming-otter-0c261f.netlify.app/>

Only files explicitly listed in `build.mjs` are copied into `dist/public`.
Files in `docs/`, local tools, the private key, and CSV exports are not
published.

## One-time local setup

### 1. Install Node.js and Netlify CLI

Netlify CLI requires Node.js 18.14.0 or later. Check the installed version:

```sh
node --version
```

Install the current Netlify CLI globally and confirm that it is available:

```sh
npm install -g netlify-cli
netlify --version
```

### 2. Sign in

From a terminal, run:

```sh
netlify login
```

This opens Netlify in the browser so the CLI can be authorized. The login only
needs to be repeated if the authorization expires or is revoked.

### 3. Connect this directory to a Netlify project

Run these commands from the repository root:

```sh
cd /path/to/galdardescansa
netlify link --name gleaming-otter-0c261f
```

This links the local directory directly to the existing
`gleaming-otter-0c261f` project. The generic interactive alternative is:

```sh
netlify link
```

Do not run `netlify init` for this repository: the Netlify project already
exists.

The link command writes the project ID to `.netlify/state.json`. The `.netlify`
directory is intentionally ignored by Git and must not be committed.

Confirm the connection:

```sh
netlify status
```

## Deploy to production

From anywhere inside or outside the repository, run the script by its path:

```sh
./tools/deploy.sh
```

The script:

1. moves to the repository root;
2. verifies that Netlify CLI is installed;
3. verifies that the directory is linked to a Netlify project;
4. runs the configured build; and
5. deploys `dist/public` to the production site.

The command publishes immediately to the live Netlify project. To inspect the
build without deploying, run:

```sh
netlify build
```

## Verify Netlify Forms after deployment

Form detection must be enabled in the Netlify project's **Forms** section. After
deploying a version that contains the form:

1. open the Netlify project's **Forms** section;
2. confirm that a form named `petition-signature` appears;
3. submit one test signature from the deployed website, not from localhost;
4. confirm that it appears under the form's verified submissions; and
5. delete the test submission.

The form uses a honeypot field and Netlify's built-in spam filtering. Because
submissions contain personal data, export only when necessary and delete the
stored submissions once the claim has been presented.

## Encrypted form submissions

The browser encrypts every signature before sending it to Netlify Forms. Netlify
stores an encrypted payload, an encrypted one-time key, and the information
needed to decrypt it. It does not receive the form fields as readable values.

The public key is deployed from `keys/public-key.pem`. The matching private key
is expected at `keys/private-key.pem`; it is excluded by `.gitignore` and must
never be committed, uploaded to Netlify, or shared.

Create at least one encrypted offline backup of `keys/private-key.pem`. If this
file and all its backups are lost, existing submissions cannot be recovered.

For instructions on exporting and decrypting submissions, see
[DECRYPT.md](DECRYPT.md).

## Automated or non-interactive deployment

For CI, use a Netlify personal access token and the Netlify Project ID through
environment variables:

```sh
NETLIFY_AUTH_TOKEN="..." NETLIFY_SITE_ID="..." ./tools/deploy.sh
```

Store these values in the CI provider's secret manager. Never add them to the
repository or commit them in an `.env` file.

The Project ID is available in Netlify under **Project configuration → General
→ Project information**. A personal access token can be created from the Netlify
user settings.

## Troubleshooting

- **`Netlify CLI not found`**: run `npm install -g netlify-cli`.
- **`This directory is not linked`**: run `netlify login`, followed by
  `netlify link --name gleaming-otter-0c261f`.
- **Wrong Netlify project**: run `netlify unlink`, followed by
  `netlify link --name gleaming-otter-0c261f`.
- **Build failure**: run `npm run build` locally and fix the reported error before
  deploying again.

