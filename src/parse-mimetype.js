const removeLeadingAndTrailingHTTPWhitespace = (string) =>
  string.replace(/^[ \t\n\r]+/, "").replace(/[ \t\n\r]+$/, "");

const removeTrailingHTTPWhitespace = (string) =>
  string.replace(/[ \t\n\r]+$/, "");

const isHTTPWhitespaceChar = (char) =>
  char === " " || char === "\t" || char === "\n" || char === "\r";

const solelyContainsHTTPTokenCodePoints = (string) =>
  /^[-!#$%&'*+.^_`|~A-Za-z0-9]*$/.test(string);

const soleyContainsHTTPQuotedStringTokenCodePoints = (string) =>
  /^[\t\u0020-\u007E\u0080-\u00FF]*$/.test(string);

const asciiLowercase = (string) =>
  string.replace(/[A-Z]/g, (l) => l.toLowerCase());

const serialize = (mimeType) => {
  let serialization = `${mimeType.type}/${mimeType.subtype}`;

  if (mimeType.parameters.size === 0) {
    return serialization;
  }

  // eslint-disable-next-line prefer-const
  for (let [name, value] of mimeType.parameters) {
    serialization += ";";
    serialization += name;
    serialization += "=";

    if (!solelyContainsHTTPTokenCodePoints(value) || value.length === 0) {
      value = value.replace(/(["\\])/g, "\\$1");
      value = `"${value}"`;
    }

    serialization += value;
  }

  return serialization;
};

function parcer(data) {
  const input = removeLeadingAndTrailingHTTPWhitespace(data);

  let position = 0;
  let type = "";
  while (position < input.length && input[position] !== "/") {
    type += input[position];
    position += 1;
  }

  if (type.length === 0 || !solelyContainsHTTPTokenCodePoints(type)) {
    return null;
  }

  if (position >= input.length) {
    return null;
  }

  // Skips past "/"
  position += 1;

  let subtype = "";
  while (position < input.length && input[position] !== ";") {
    subtype += input[position];
    position += 1;
  }

  subtype = removeTrailingHTTPWhitespace(subtype);

  if (subtype.length === 0 || !solelyContainsHTTPTokenCodePoints(subtype)) {
    return null;
  }

  const mimeType = {
    type: asciiLowercase(type),
    subtype: asciiLowercase(subtype),
    parameters: new Map(),
  };

  while (position < input.length) {
    // Skip past ";"
    position += 1;

    while (isHTTPWhitespaceChar(input[position])) {
      position += 1;
    }

    let parameterName = "";
    while (
      position < input.length &&
      input[position] !== ";" &&
      input[position] !== "="
    ) {
      parameterName += input[position];
      position += 1;
    }
    parameterName = asciiLowercase(parameterName);

    if (position < input.length) {
      if (input[position] === ";") {
        // eslint-disable-next-line no-continue
        continue;
      }

      // Skip past "="
      position += 1;
    }

    let parameterValue = "";
    if (input[position] === '"') {
      position += 1;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        while (
          position < input.length &&
          input[position] !== '"' &&
          input[position] !== "\\"
        ) {
          parameterValue += input[position];
          position += 1;
        }

        break;
      }

      while (position < input.length && input[position] !== ";") {
        position += 1;
      }
    } else {
      while (position < input.length && input[position] !== ";") {
        parameterValue += input[position];
        position += 1;
      }

      parameterValue = removeTrailingHTTPWhitespace(parameterValue);

      if (parameterValue === "") {
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    if (
      parameterName.length > 0 &&
      solelyContainsHTTPTokenCodePoints(parameterName) &&
      soleyContainsHTTPQuotedStringTokenCodePoints(parameterValue) &&
      !mimeType.parameters.has(parameterName)
    ) {
      mimeType.parameters.set(parameterName, parameterValue);
    }
  }

  return mimeType;
}

function getMimeTypeRecord(input) {
  const result = parcer(input);

  result.toString = function toString() {
    return serialize(this);
  };

  return result;
}

export default getMimeTypeRecord;
