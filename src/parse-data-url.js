import MIMEType from 'whatwg-mimetype';
import { percentDecode } from 'whatwg-url';
import { atob } from 'abab';

export default function parseDataUrl(stringInput) {
  let parsedUrl;

  try {
    parsedUrl = new URL(stringInput);
  } catch (error) {
    return null;
  }

  if (parsedUrl.protocol !== 'data:') {
    return null;
  }

  parsedUrl.hash = '';

  // `5` is value of `'data:'.length`
  const input = parsedUrl.toString().substring(5);

  let position = 0;
  let mimeType = '';

  while (position < input.length && input[position] !== ',') {
    mimeType += input[position];
    position += 1;
  }

  mimeType = mimeType.replace(/^[ \t\n\f\r]+/, '').replace(/[ \t\n\f\r]+$/, '');

  if (position === input.length) {
    return null;
  }

  position += 1;

  const encodedBody = input.substring(position);

  let body = Buffer.from(percentDecode(Buffer.from(encodedBody, 'utf-8')));

  // Can't use /i regexp flag because it isn't restricted to ASCII.
  const mimeTypeBase64MatchResult = /(.*); *[Bb][Aa][Ss][Ee]64$/.exec(mimeType);

  if (mimeTypeBase64MatchResult) {
    const stringBody = body.toString('binary');
    const asString = atob(stringBody);

    if (asString === null) {
      return null;
    }

    body = Buffer.from(asString, 'binary');

    [, mimeType] = mimeTypeBase64MatchResult;
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

  return { mimeType: mimeTypeRecord, body };
}
