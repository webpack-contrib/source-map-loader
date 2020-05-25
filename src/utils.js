import path from 'path';
import urlUtils from 'url';

import sourceMap from 'source-map';

import { urlToRequest } from 'loader-utils';

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

function getAbsoluteURL(context, url, sourceRoot) {
  const request = urlToRequest(url, true);

  if (sourceRoot) {
    if (path.isAbsolute(sourceRoot)) {
      return path.join(sourceRoot, request);
    }

    return path.join(context, urlToRequest(sourceRoot, true), request);
  }

  return path.join(context, request);
}

async function readFromFs(loaderContext, sourceURL) {
  let buffer;

  try {
    buffer = await new Promise((resolve, reject) => {
      loaderContext.fs.readFile(sourceURL, (error, data) => {
        if (error) {
          return reject(error);
        }

        return resolve(data);
      });
    });
  } catch (error) {
    throw new Error(`Cannot read '${sourceURL}' file: ${error}`);
  }

  return buffer.toString();
}

async function fetchFromURL(
  loaderContext,
  context,
  url,
  sourceRoot,
  skipReading = false
) {
  // 1. It's an absolute url and it is not `windows` path like `C:\dir\file`
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !path.win32.isAbsolute(url)) {
    const { protocol } = urlUtils.parse(url);

    if (protocol === 'file:') {
      const pathFromURL = urlUtils.fileURLToPath(url);
      const sourceURL = getAbsoluteURL(context, pathFromURL, sourceRoot);

      let sourceContent;

      if (!skipReading) {
        sourceContent = await readFromFs(loaderContext, sourceURL);
      }

      return { sourceURL, sourceContent };
    }

    throw new Error(`Absolute '${url}' URL is not supported`);
  }

  // 2. It's a scheme-relative
  if (/^\/\//.test(url)) {
    throw new Error(`Scheme-relative '${url}' URL is not supported`);
  }

  // 3. Absolute path
  if (path.isAbsolute(url)) {
    const sourceURL = path.normalize(url);

    let sourceContent;

    if (!skipReading) {
      sourceContent = await readFromFs(loaderContext, sourceURL);
    }

    return { sourceURL, sourceContent };
  }

  // 4. Relative path
  const sourceURL = getAbsoluteURL(context, url, sourceRoot);

  let sourceContent;

  if (!skipReading) {
    sourceContent = await readFromFs(loaderContext, sourceURL);
  }

  return { sourceURL, sourceContent };
}

export { getSourceMappingUrl, fetchFromURL, flattenSourceMap };
