const form = document.querySelector("#signature-form");
const statusMessage = document.querySelector("#form-status");
const submitButton = form.querySelector('button[type="submit"]');
const updatesConsent = document.querySelector("#updates-consent");
const successModal = document.querySelector("#success-modal");
const closeSuccessModalButton = document.querySelector(
  "#close-success-modal",
);
const shareButton = document.querySelector("#share-petition");
const shareFeedback = document.querySelector("#share-feedback");

const CRYPTO_VERSION = "1";
const ENCRYPTION_ALGORITHM = "RSA-OAEP-3072+AES-256-GCM";
const ENCRYPTION_CONTEXT = "galdar-descansa";
const PRIVACY_POLICY_VERSION = "2026-09-27";

let encryptionKey = null;
let encryptionKeyId = null;

const fields = {
  name: {
    input: document.querySelector("#name"),
    error: document.querySelector("#name-error"),
    requiredMessage: "Introduce tu nombre.",
  },
  surnames: {
    input: document.querySelector("#surnames"),
    error: document.querySelector("#surnames-error"),
    requiredMessage: "Introduce tus apellidos.",
  },
  identityDocument: {
    input: document.querySelector("#identity-document"),
    error: document.querySelector("#identity-document-error"),
    requiredMessage: "Introduce tu DNI o NIE.",
    validate(value) {
      return /^(?:\d{8}|[XYZ]\d{7})[A-Z]$/i.test(
        value.replace(/[\s-]/g, ""),
      )
        ? ""
        : "Revisa el formato del DNI o NIE.";
    },
  },
  address: {
    input: document.querySelector("#address"),
    error: document.querySelector("#address-error"),
    requiredMessage: "Introduce la dirección del domicilio afectado.",
  },
  phone: {
    input: document.querySelector("#phone"),
    error: document.querySelector("#phone-error"),
    validate(value) {
      if (!value) return "";
      return /^[+\d][\d\s-]{7,16}$/.test(value)
        ? ""
        : "Revisa el formato del teléfono.";
    },
  },
  email: {
    input: document.querySelector("#email"),
    error: document.querySelector("#email-error"),
    requiredMessage: "Introduce tu correo electrónico.",
    validate(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? ""
        : "Introduce un correo electrónico válido.";
    },
  },
  privacyConsent: {
    input: document.querySelector("#privacy-consent"),
    error: document.querySelector("#privacy-consent-error"),
    requiredMessage: "Debes aceptar la política de privacidad para continuar.",
  },
};

function validateField(field) {
  const value =
    field.input.type === "checkbox"
      ? field.input.checked
      : field.input.value.trim();
  let message = "";

  if (field.input.required && !value) {
    message = field.requiredMessage;
  } else if (field.validate) {
    message = field.validate(value);
  }

  field.error.textContent = message;
  field.input.setAttribute("aria-invalid", String(Boolean(message)));
  return !message;
}

function decodePem(pem) {
  const base64 = pem
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  return btoa(binary);
}

async function loadEncryptionKey() {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this browser");
  }

  const response = await fetch("keys/public-key.pem", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load the public key: ${response.status}`);
  }

  const keyBytes = decodePem(await response.text());
  const [publicKey, fingerprint] = await Promise.all([
    window.crypto.subtle.importKey(
      "spki",
      keyBytes,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    ),
    window.crypto.subtle.digest("SHA-256", keyBytes),
  ]);

  return {
    publicKey,
    keyId: Array.from(new Uint8Array(fingerprint).slice(0, 8), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}

function collectSensitiveData() {
  return {
    name: fields.name.input.value.trim(),
    surnames: fields.surnames.input.value.trim(),
    identityDocument: fields.identityDocument.input.value
      .replace(/[\s-]/g, "")
      .toUpperCase(),
    address: fields.address.input.value.trim(),
    phone: fields.phone.input.value.trim(),
    email: fields.email.input.value.trim(),
    privacyConsent: fields.privacyConsent.input.checked,
    updatesConsent: updatesConsent.checked,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    submittedAt: new Date().toISOString(),
  };
}

async function encryptSensitiveData(data) {
  if (!encryptionKey || !encryptionKeyId) {
    throw new Error("The form encryption key is not ready");
  }

  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"],
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(
    `${ENCRYPTION_CONTEXT}:v${CRYPTO_VERSION}:${encryptionKeyId}`,
  );
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const [encryptedPayload, rawAesKey] = await Promise.all([
    window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData, tagLength: 128 },
      aesKey,
      plaintext,
    ),
    window.crypto.subtle.exportKey("raw", aesKey),
  ]);
  const encryptedKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    encryptionKey,
    rawAesKey,
  );

  return {
    cryptoVersion: CRYPTO_VERSION,
    algorithm: ENCRYPTION_ALGORITHM,
    keyId: encryptionKeyId,
    iv: bufferToBase64(iv),
    encryptedKey: bufferToBase64(encryptedKey),
    encryptedPayload: bufferToBase64(encryptedPayload),
  };
}

async function initializeEncryption() {
  try {
    const key = await loadEncryptionKey();
    encryptionKey = key.publicKey;
    encryptionKeyId = key.keyId;
    submitButton.disabled = false;
  } catch (error) {
    console.error("Unable to initialize form encryption", error);
    statusMessage.textContent =
      "El formulario seguro no está disponible en este momento. Inténtalo de nuevo más tarde.";
    statusMessage.classList.add("form-status--error");
  }
}

Object.values(fields).forEach((field) => {
  field.input.addEventListener("blur", () => validateField(field));
  field.input.addEventListener("input", () => {
    if (field.input.getAttribute("aria-invalid") === "true") {
      validateField(field);
    }
  });
});

function resetSuccessModal() {
  if (successModal.open) successModal.close();
  shareFeedback.textContent = "";
  shareButton.textContent = "Compartir la petición";
}

closeSuccessModalButton.addEventListener("click", () => {
  successModal.close();
});

successModal.addEventListener("click", (event) => {
  if (event.target === successModal) successModal.close();
});

shareButton.addEventListener("click", async () => {
  const shareUrl =
    document.querySelector('meta[property="og:url"]')?.content ??
    new URL("/", window.location.href).href;
  const shareData = {
    title: "Gáldar Quiere Descansar",
    text: "Ayuda a exigir medidas contra el ruido nocturno en Gáldar firmando esta petición.",
    url: shareUrl,
  };

  shareFeedback.textContent = "";

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      shareFeedback.textContent = "Gracias por compartir la petición.";
    } catch (error) {
      if (error.name !== "AbortError") {
        shareFeedback.textContent =
          "No se ha podido abrir el menú para compartir. Inténtalo de nuevo.";
      }
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    shareButton.textContent = "Enlace copiado";
    shareFeedback.textContent =
      "El enlace se ha copiado. Ya puedes compartirlo donde quieras.";
  } catch (error) {
    console.error("Unable to copy the petition URL", error);
    shareFeedback.textContent = `Copia y comparte este enlace: ${shareUrl}`;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.className = "form-status";
  resetSuccessModal();

  const validity = Object.values(fields).map(validateField);
  const firstInvalidField = Object.values(fields).find(
    (field) => field.input.getAttribute("aria-invalid") === "true",
  );

  if (validity.includes(false)) {
    statusMessage.textContent = "Revisa los campos indicados antes de continuar.";
    statusMessage.classList.add("form-status--error");
    firstInvalidField?.input.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando…";
  form.setAttribute("aria-busy", "true");
  statusMessage.textContent = "Enviando tu firma…";

  try {
    const encryptedData = await encryptSensitiveData(collectSensitiveData());
    const formData = new URLSearchParams({
      "form-name": form.getAttribute("name"),
      "bot-field": form.elements.namedItem("bot-field")?.value ?? "",
      ...encryptedData,
    });
    const response = await fetch("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`Form submission failed with status ${response.status}`);
    }

    form.reset();
    Object.values(fields).forEach((field) => {
      field.error.textContent = "";
      field.input.setAttribute("aria-invalid", "false");
    });
    statusMessage.textContent = "";
    successModal.showModal();
  } catch (error) {
    console.error("Unable to submit the signature form", error);
    statusMessage.textContent =
      "No se ha podido enviar la firma. Inténtalo de nuevo en unos minutos.";
    statusMessage.classList.add("form-status--error");
  } finally {
    submitButton.disabled = !encryptionKey;
    submitButton.textContent = "Firmar la petición";
    form.removeAttribute("aria-busy");
  }
});

initializeEncryption();
