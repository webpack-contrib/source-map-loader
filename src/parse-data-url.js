import MIMEType from 'whatwg-mimetype';
import { parseURL, serializeURL, percentDecode } from 'whatwg-url';
import { atob } from 'abab';

const stripLeadingAndTrailingASCIIWhitespace = (string) => {
  return string.replace(/^[ \t\n\f\r]+/, '').replace(/[ \t\n\f\r]+$/, '');
};

const stringPercentDecode = (input) => {
  return percentDecode(Buffer.from(input, 'utf-8'));
};

const isomorphicDecode = (input) => {
  return input.toString('binary');
};

const forgivingBase64Decode = (data) => {
  const asString = atob(data);

  if (asString === null) {
    return null;
  }
  return Buffer.from(asString, 'binary');
};

export default function parseDataUrl(stringInput) {
  const urlRecord = parseURL(stringInput);

  if (urlRecord === null) {
    return null;
  }

  return fromURLRecord(urlRecord);
}

function fromURLRecord(urlRecord) {
  if (urlRecord.scheme !== 'data') {
    return null;
  }

  const input = serializeURL(urlRecord, true).substring('data:'.length);

  let position = 0;

  let mimeType = '';
  while (position < input.length && input[position] !== ',') {
    mimeType += input[position];
    // eslint-disable-next-line no-plusplus
    ++position;
  }
  mimeType = stripLeadingAndTrailingASCIIWhitespace(mimeType);

  if (position === input.length) {
    return null;
  }

  // eslint-disable-next-line no-plusplus
  ++position;

  const encodedBody = input.substring(position);

  let body = Buffer.from(stringPercentDecode(encodedBody));

  // Can't use /i regexp flag because it isn't restricted to ASCII.
  const mimeTypeBase64MatchResult = /(.*); *[Bb][Aa][Ss][Ee]64$/.exec(mimeType);

  if (mimeTypeBase64MatchResult) {
    const stringBody = isomorphicDecode(body);

    body = forgivingBase64Decode(stringBody);

    if (body === null) {
      return null;
    }
    // eslint-disable-next-line prefer-destructuring
    mimeType = mimeTypeBase64MatchResult[1];
  }

  if (mimeType.startsWith(';')) {
    mimeType = `text/plain ${mimeType}`;
  }

  let mimeTypeRecord;
  try {
    mimeTypeRecord = new MIMEType(mimeType);
  } catch (e) {
    mimeTypeRecord = new MIMEType('text/plain;charset=US-ASCII');
  }

  return {
    mimeType: mimeTypeRecord,
    body,
  };
}
