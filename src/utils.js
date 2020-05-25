import path from 'path';

import urlUtils from 'url';

import sourceMap from 'source-map';

// Matches only the last occurrence of sourceMappingURL
const innerRegex = /\s*[#@]\s*sourceMappingURL\s*=\s*([^\s'"]*)\s*/;

/* eslint-disable prefer-template */
const sourceMappingURLRegex = RegExp(
  '(?:' +
    '/\\*' +
    '(?:\\s*\r?\n(?://)?)?' +
    '(?:' +
    innerRegex.source +
    ')' +
    '\\s*' +
    '\\*/' +
    '|' +
    '//(?:' +
    innerRegex.source +
    ')' +
    ')' +
    '\\s*'
);
/* eslint-enable prefer-template */

async function flattenSourceMap(map) {
  const consumer = await new sourceMap.SourceMapConsumer(map);
  let generatedMap;

  if (map.file) {
    generatedMap = new sourceMap.SourceMapGenerator({
      file: map.file,
    });
  } else {
    generatedMap = new sourceMap.SourceMapGenerator();
  }

  consumer.sources.forEach((sourceFile) => {
    const sourceContent = consumer.sourceContentFor(sourceFile, true);
    generatedMap.setSourceContent(sourceFile, sourceContent);
  });

  consumer.eachMapping((mapping) => {
    const { source } = consumer.originalPositionFor({
      line: mapping.generatedLine,
      column: mapping.generatedColumn,
    });

    const mappings = {
      source,
      original: {
        line: mapping.originalLine,
        column: mapping.originalColumn,
      },
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
    };

    if (source) {
      generatedMap.addMapping(mappings);
    }
  });

  return generatedMap.toJSON();
}

function isUrlRequest(url) {
  // An URL is not an request if

  // 1. It's an absolute url and it is not `windows` path like `C:\dir\file`
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !path.win32.isAbsolute(url)) {
    return false;
  }

  // 2. It's a protocol-relative
  if (/^\/\//.test(url)) {
    return false;
  }

  return true;
}

function getSourceMappingUrl(code) {
  const lines = code.split(/^/m);
  let match;

  for (let i = lines.length - 1; i >= 0; i--) {
    match = lines[i].match(sourceMappingURLRegex);
    if (match) {
      break;
    }
  }

  return {
    url: match ? match[1] || match[2] || '' : null,
    replacementString: match ? match[0] : null,
  };
}

function getRequestedUrl(url) {
  if (isUrlRequest(url)) {
    return url;
  }

  const { protocol } = urlUtils.parse(url);

  if (protocol !== 'file:') {
    throw new Error(`URL scheme not supported: ${protocol}`);
  }

  try {
    return urlUtils.fileURLToPath(url);
  } catch (error) {
    throw new Error(error);
  }
}

function getAbsolutePathToSource(context, source, map) {
  if (path.isAbsolute(source)) {
    return source;
  }

  if (map.sourceRoot) {
    if (path.isAbsolute(map.sourceRoot)) {
      return path.join(map.sourceRoot, source);
    }

    return path.join(context, map.sourceRoot, source);
  }

  return path.join(context, source);
}

export {
  flattenSourceMap,
  isUrlRequest,
  getSourceMappingUrl,
  getRequestedUrl,
  getAbsolutePathToSource,
};
