#!/usr/bin/env node

import {
  constants,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
} from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CRYPTO_VERSION = "1";
const ENCRYPTION_ALGORITHM = "RSA-OAEP-3072+AES-256-GCM";
const ENCRYPTION_CONTEXT = "galdar-descansa";
const AUTH_TAG_LENGTH = 16;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const privateKeyPath = resolve(projectDirectory, "keys/private-key.pem");

function showUsage() {
  console.log(
    "Usage: node tools/decrypt-submissions.mjs <input.csv> [output.csv]",
  );
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("The CSV contains an unterminated quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error("The CSV file is empty");
  }

  rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  const headers = rows[0];

  return {
    headers,
    records: rows
      .slice(1)
      .filter((values) => values.some((value) => value.trim() !== ""))
      .map((values) =>
        Object.fromEntries(
          headers.map((header, index) => [header, values[index] ?? ""]),
        ),
      ),
  };
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(headers, expectedName) {
  const normalizedName = normalizeHeader(expectedName);
  return headers.find((header) => normalizeHeader(header) === normalizedName);
}

function getRequiredValue(record, headers, fieldName, rowNumber) {
  const header = findHeader(headers, fieldName);

  if (!header || !record[header]) {
    throw new Error(`Row ${rowNumber} is missing ${fieldName}`);
  }

  return record[header];
}

function getOptionalValue(record, headers, possibleNames) {
  for (const name of possibleNames) {
    const header = findHeader(headers, name);
    if (header && record[header]) return record[header];
  }
  return "";
}

function protectSpreadsheetCell(value) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function encodeCsvCell(value) {
  return `"${protectSpreadsheetCell(value).replaceAll('"', '""')}"`;
}

function encodeCsv(rows) {
  return `${rows.map((row) => row.map(encodeCsvCell).join(",")).join("\n")}\n`;
}

function defaultOutputPath(inputPath) {
  const extension = extname(inputPath);
  return extension.toLowerCase() === ".csv"
    ? `${inputPath.slice(0, -extension.length)}.decrypted.csv`
    : `${inputPath}.decrypted.csv`;
}

function decryptRecord(record, headers, privateKey, expectedKeyId, rowNumber) {
  const cryptoVersion = getRequiredValue(
    record,
    headers,
    "cryptoVersion",
    rowNumber,
  );
  const algorithm = getRequiredValue(record, headers, "algorithm", rowNumber);
  const keyId = getRequiredValue(record, headers, "keyId", rowNumber);

  if (cryptoVersion !== CRYPTO_VERSION) {
    throw new Error(
      `Row ${rowNumber} uses unsupported crypto version ${cryptoVersion}`,
    );
  }

  if (algorithm !== ENCRYPTION_ALGORITHM) {
    throw new Error(`Row ${rowNumber} uses unsupported algorithm ${algorithm}`);
  }

  if (keyId !== expectedKeyId) {
    throw new Error(
      `Row ${rowNumber} was encrypted for key ${keyId}, not ${expectedKeyId}`,
    );
  }

  const encryptedKey = Buffer.from(
    getRequiredValue(record, headers, "encryptedKey", rowNumber),
    "base64",
  );
  const iv = Buffer.from(
    getRequiredValue(record, headers, "iv", rowNumber),
    "base64",
  );
  const encryptedPayload = Buffer.from(
    getRequiredValue(record, headers, "encryptedPayload", rowNumber),
    "base64",
  );

  if (iv.length !== 12 || encryptedPayload.length <= AUTH_TAG_LENGTH) {
    throw new Error(`Row ${rowNumber} contains an invalid encrypted payload`);
  }

  const aesKey = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedKey,
  );
  const authenticationTag = encryptedPayload.subarray(-AUTH_TAG_LENGTH);
  const ciphertext = encryptedPayload.subarray(0, -AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAAD(
    Buffer.from(`${ENCRYPTION_CONTEXT}:v${cryptoVersion}:${keyId}`, "utf8"),
  );
  decipher.setAuthTag(authenticationTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  const data = JSON.parse(plaintext);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Row ${rowNumber} did not contain a valid form submission`);
  }

  return data;
}

async function main() {
  const [inputArgument, outputArgument] = process.argv.slice(2);

  if (!inputArgument || inputArgument === "--help" || inputArgument === "-h") {
    showUsage();
    process.exitCode = inputArgument ? 0 : 1;
    return;
  }

  const inputPath = resolve(inputArgument);
  const outputPath = outputArgument
    ? resolve(outputArgument)
    : defaultOutputPath(inputPath);

  if (inputPath === outputPath) {
    throw new Error("The input and output paths must be different");
  }

  const [csvSource, privateKey] = await Promise.all([
    readFile(inputPath, "utf8"),
    readFile(privateKeyPath, "utf8"),
  ]);
  const privateKeyOptions = process.env.PRIVATE_KEY_PASSPHRASE
    ? { key: privateKey, passphrase: process.env.PRIVATE_KEY_PASSPHRASE }
    : privateKey;
  const privateKeyObject = createPrivateKey(privateKeyOptions);
  const publicKeyDer = createPublicKey(privateKeyObject).export({
    type: "spki",
    format: "der",
  });
  const expectedKeyId = createHash("sha256")
    .update(publicKeyDer)
    .digest("hex")
    .slice(0, 16);
  const { headers, records } = parseCsv(csvSource);

  if (records.length === 0) {
    throw new Error("The CSV does not contain any submissions");
  }

  const outputHeaders = [
    "sourceRow",
    "netlifySubmissionId",
    "netlifyCreatedAt",
    "name",
    "surnames",
    "identityDocument",
    "address",
    "phone",
    "email",
    "privacyConsent",
    "updatesConsent",
    "privacyPolicyVersion",
    "submittedAt",
  ];
  const outputRows = [outputHeaders];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const data = decryptRecord(
      record,
      headers,
      privateKeyObject,
      expectedKeyId,
      rowNumber,
    );

    outputRows.push([
      rowNumber,
      getOptionalValue(record, headers, ["id", "submissionId"]),
      getOptionalValue(record, headers, ["createdAt", "created_at", "date"]),
      data.name,
      data.surnames,
      data.identityDocument,
      data.address,
      data.phone,
      data.email,
      data.privacyConsent,
      data.updatesConsent,
      data.privacyPolicyVersion,
      data.submittedAt,
    ]);
  });

  await writeFile(outputPath, encodeCsv(outputRows), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(outputPath, 0o600);

  console.log(
    `Decrypted ${records.length} submission${records.length === 1 ? "" : "s"} to ${outputPath}`,
  );
}

main().catch((error) => {
  console.error(`Unable to decrypt submissions: ${error.message}`);
  process.exitCode = 1;
});
