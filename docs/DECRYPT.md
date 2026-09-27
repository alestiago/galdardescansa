# Decrypting Netlify form submissions

`tools/decrypt-submissions.mjs` converts a CSV export from the Netlify form into
a readable CSV. Decryption happens entirely on your computer. The encrypted
input file is not modified.

The script uses only Node.js built-in modules, so there are no additional
packages to install.

## Recommended: interactive helper

From the repository root, run:

```sh
./tools/decrypt.sh
```

The helper:

1. checks that Node.js and `keys/private-key.pem` are available;
2. asks which directory contains the Netlify CSV export;
3. finds the `.csv` files in that directory and lets you choose one by number;
4. excludes files already ending in `.decrypted.csv` from the suggestions;
5. proposes an output filename;
6. asks before overwriting an existing output; and
7. shows the selected paths before starting local decryption.

Enter `q` at the directory or file-selection prompt to cancel without changing
anything.

The remaining sections document the same process manually and explain the
expected files and possible errors.

## Security requirements

- Run the script only on a trusted computer.
- Keep `keys/private-key.pem` private and never upload or email it.
- Keep an encrypted offline backup of the private key. Without it, existing
  submissions cannot be recovered.
- Store decrypted CSV files outside the repository, preferably on an encrypted
  disk.
- Delete Netlify exports and decrypted copies when they are no longer required.

The script always reads the private key from:

```text
keys/private-key.pem
```

The private key is ignored by Git and is not included in the Netlify build.

## Manual process

### 1. Export the encrypted submissions

In Netlify:

1. open the `gleaming-otter-0c261f` project;
2. go to **Forms**;
3. select `petition-signature`;
4. open the verified submissions; and
5. export the submissions as CSV.

Do not modify the encrypted CSV before decrypting it. The script expects the
fields `cryptoVersion`, `algorithm`, `keyId`, `iv`, `encryptedKey`, and
`encryptedPayload` produced by the website.

### 2. Confirm that the private key is available

From the repository root, check that the expected key exists:

```sh
test -f keys/private-key.pem && echo "Private key found"
```

Restrict its permissions to your user account:

```sh
chmod 600 keys/private-key.pem
```

### 3. Decrypt the CSV

Run the following command from the repository root, replacing the input path
with the location of the CSV downloaded from Netlify:

```sh
node tools/decrypt-submissions.mjs /path/to/petition-signature.csv
```

By default, the result is written next to the input file:

```text
/path/to/petition-signature.decrypted.csv
```

To choose a safer output location explicitly, provide it as the second
argument:

```sh
node tools/decrypt-submissions.mjs \
  /path/to/petition-signature.csv \
  /secure/path/to/petition-signatures.decrypted.csv
```

Wrap paths containing spaces in quotes:

```sh
node tools/decrypt-submissions.mjs \
  "/path/with spaces/petition-signature.csv" \
  "/secure/path/petition-signatures.decrypted.csv"
```

The output is created with owner-only permissions (`600`). Files ending in
`.decrypted.csv` are also ignored by Git as an additional safeguard.

## Password-protected private keys

If `private-key.pem` is protected by a passphrase, provide it through the
`PRIVATE_KEY_PASSPHRASE` environment variable. To avoid placing the passphrase
directly in your shell history:

```sh
read -s PRIVATE_KEY_PASSPHRASE
export PRIVATE_KEY_PASSPHRASE
node tools/decrypt-submissions.mjs /path/to/petition-signature.csv
unset PRIVATE_KEY_PASSPHRASE
```

Press Enter after typing the passphrase. Nothing is displayed while you type.

## Output columns

The decrypted CSV contains:

1. source row number;
2. Netlify submission ID and creation date, when present;
3. name and surnames;
4. DNI or NIE;
5. affected address;
6. telephone and email;
7. privacy and updates consent values;
8. privacy-policy version; and
9. the timestamp recorded by the browser when the form was submitted.

Values that spreadsheet applications could interpret as formulas are prefixed
with an apostrophe as a safety measure.

## Common errors

- **`ENOENT ... keys/private-key.pem`**: place the matching private key at the
  expected path and try again.
- **`was encrypted for key ... not ...`**: the CSV was encrypted with a different
  key pair. Restore the matching private key backup.
- **`missing encryptedPayload`** or another missing-field error: confirm that the
  file is the unmodified CSV exported from the correct Netlify form.
- **`Unsupported state or unable to authenticate data`**: the encrypted payload
  is incomplete, corrupted, modified, or was produced with a different key.
- **`The CSV does not contain any submissions`**: export verified submissions
  containing at least one completed form.

To display the command syntax at any time, run:

```sh
node tools/decrypt-submissions.mjs --help
```
