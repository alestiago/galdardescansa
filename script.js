const form = document.querySelector("#signature-form");
const statusMessage = document.querySelector("#form-status");

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
};

function validateField(field) {
  const value = field.input.value.trim();
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

Object.values(fields).forEach((field) => {
  field.input.addEventListener("blur", () => validateField(field));
  field.input.addEventListener("input", () => {
    if (field.input.getAttribute("aria-invalid") === "true") {
      validateField(field);
    }
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  statusMessage.className = "form-status";

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

  statusMessage.textContent =
    "Formulario validado. La conexión para enviar la firma está pendiente de configurar.";
  statusMessage.classList.add("form-status--success");
});
