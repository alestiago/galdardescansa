#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_directory="$(cd -- "${script_directory}/.." && pwd)"
decrypt_script="${script_directory}/decrypt-submissions.mjs"
private_key="${project_directory}/keys/private-key.pem"
starting_directory="$(pwd)"

expand_user_path() {
  local path="$1"

  if [[ "${path}" == "~" ]]; then
    printf '%s\n' "${HOME}"
  elif [[ "${path}" == "~/"* ]]; then
    printf '%s\n' "${HOME}/${path:2}"
  else
    printf '%s\n' "${path}"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js before running this tool." >&2
  exit 1
fi

if [[ ! -f "${private_key}" ]]; then
  echo "Private key not found: ${private_key}" >&2
  echo "Restore the matching private key before decrypting submissions." >&2
  exit 1
fi

if [[ ! -r "${private_key}" ]]; then
  echo "Private key is not readable: ${private_key}" >&2
  exit 1
fi

echo "Private key found."
echo "This tool decrypts a Netlify CSV locally; it does not upload any data."

while true; do
  printf '\nDirectory containing the Netlify CSV [%s]: ' "${starting_directory}"
  IFS= read -r csv_directory
  csv_directory="${csv_directory:-${starting_directory}}"

  if [[ "${csv_directory}" == "q" || "${csv_directory}" == "Q" ]]; then
    echo "Cancelled."
    exit 0
  fi

  csv_directory="$(expand_user_path "${csv_directory}")"

  if [[ ! -d "${csv_directory}" ]]; then
    echo "Directory not found: ${csv_directory}" >&2
    echo "Enter another directory, or q to cancel."
    continue
  fi

  csv_files=()
  while IFS= read -r -d '' csv_file; do
    csv_files+=("${csv_file}")
  done < <(
    find "${csv_directory}" -maxdepth 1 -type f -iname '*.csv' \
      ! -iname '*.decrypted.csv' -print0
  )

  if [[ ${#csv_files[@]} -eq 0 ]]; then
    echo "No encrypted CSV candidates were found in ${csv_directory}."
    echo "Enter another directory, or q to cancel."
    continue
  fi

  break
done

printf '\nCSV files found:\n'
for ((index = 0; index < ${#csv_files[@]}; index += 1)); do
  printf '  %d) %s\n' "$((index + 1))" "$(basename -- "${csv_files[index]}")"
done
echo "  q) Cancel"

while true; do
  if [[ ${#csv_files[@]} -eq 1 ]]; then
    printf 'Choose a file [1]: '
  else
    printf 'Choose a file [1-%d]: ' "${#csv_files[@]}"
  fi

  IFS= read -r selection

  if [[ "${selection}" == "q" || "${selection}" == "Q" ]]; then
    echo "Cancelled."
    exit 0
  fi

  if [[ -z "${selection}" && ${#csv_files[@]} -eq 1 ]]; then
    selection="1"
  fi

  if [[ "${selection}" =~ ^[0-9]+$ ]]; then
    selected_index=$((10#${selection} - 1))
    if ((selected_index >= 0 && selected_index < ${#csv_files[@]})); then
      input_csv="${csv_files[selected_index]}"
      break
    fi
  fi

  echo "Invalid selection."
done

default_output="${input_csv%.*}.decrypted.csv"
printf '\nOutput CSV [%s]: ' "${default_output}"
IFS= read -r output_csv
output_csv="${output_csv:-${default_output}}"
output_csv="$(expand_user_path "${output_csv}")"

if [[ "${input_csv}" == "${output_csv}" ]]; then
  echo "The input and output paths must be different." >&2
  exit 1
fi

if [[ -e "${output_csv}" ]]; then
  printf 'The output file already exists. Overwrite it? [y/N]: '
  IFS= read -r overwrite_answer
  case "${overwrite_answer}" in
    y | Y | yes | YES | Yes) ;;
    *)
      echo "Cancelled without overwriting the existing file."
      exit 0
      ;;
  esac
fi

printf '\nInput:  %s\n' "${input_csv}"
printf 'Output: %s\n' "${output_csv}"
printf 'Continue with local decryption? [Y/n]: '
IFS= read -r confirmation

case "${confirmation}" in
  n | N | no | NO | No)
    echo "Cancelled."
    exit 0
    ;;
esac

node "${decrypt_script}" "${input_csv}" "${output_csv}"

echo "Keep the decrypted CSV secure and delete it when it is no longer needed."
