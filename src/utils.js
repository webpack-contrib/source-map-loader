import path from 'path';

import urlUtils from 'url';
import { promisify } from 'util';

import sourceMap from 'source-map';
import parseDataURL from 'data-urls';
import { decode, labelToName } from 'whatwg-encoding';
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

function errorsHandle(error, loaderContext) {
  switch (error.type) {
    case 'noFetchReader':
      loaderContext.emitWarning(error.message);
      break;
    case 'pathExtract':
      loaderContext.emitWarning(error.message);
      break;
    case 'resolveError':
      loaderContext.emitWarning(error.message);
      break;
    case 'noSupportedUrl':
      loaderContext.emitWarning(error.message);
      break;
    default:
      loaderContext.emitWarning(error.message);
  }
}

function extractUrl(url) {
  try {
    return urlUtils.fileURLToPath(url);
  } catch (error) {
    const pathExtractError = new Error(error);
    pathExtractError.type = 'pathExtract';
    throw pathExtractError;
  }
}

async function fetchData(url, reader) {
  if (!reader) {
    const error = new Error(
      `Fetch reader is not defined, can not download: ${url}`
    );
    error.type = 'noFetchReader';
    throw error;
  }

  let content;

  try {
    content = await reader(url);
    return { source: url, content };
  } catch (fetchError) {
    const error = new Error(`Cannot fetch source file '${url}': ${fetchError}`);
    error.type = 'fetch';
    throw error;
  }
}

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

function getContentFromSourcesContent(consumer, source) {
  return consumer.sourceContentFor(source, true);
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

async function getUrlContent({
  context,
  url,
  fetchReader,
  loaderContext,
  originalData,
}) {
  const resolver = promisify(loaderContext.resolve);
  const reader = promisify(loaderContext.fs.readFile).bind(loaderContext.fs);
  const { addDependency } = loaderContext;

  let result;

  switch (getUrlType(url)) {
    case 'data':
      result = extractDataContent(url);
      break;

    case 'fileProtocol':
      result = await readFs({
        context,
        url: extractUrl(url),
        resolver,
        reader,
        addDependency,
      });
      break;

    case 'fetch':
      if (originalData) {
        result = { source: url, content: originalData };
      } else {
        result = await fetchData(url, fetchReader);
      }
      break;

    case 'fileFromFs':
      result = await readFs({ context, url, resolver, reader, addDependency });
      break;

    default: {
      const error = new Error(`URL not supported: ${url}`);
      error.type = 'noSupportedUrl';
      throw error;
    }
  }

  return result;
}

function getUrlType(url) {
  if (url.toLowerCase().startsWith('data:')) {
    return 'data';
  }

  if (/^file:\/\//.test(url)) {
    return 'fileProtocol';
  }

  if (/^https?:\/\//.test(url)) {
    return 'fetch';
  }

  if (isUrlRequest(url)) {
    return 'fileFromFs';
  }

  return false;
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

function extractDataContent(url) {
  const dataURL = parseDataURL(url);

  if (!dataURL) {
    throw new Error(`Cannot parse inline SourceMap: ${url}`);
  }

  dataURL.encodingName =
    labelToName(dataURL.mimeType.parameters.get('charset')) || 'UTF-8';

  const map = decode(dataURL.body, dataURL.encodingName);

  return { source: url, content: map };
}

async function readFs({ context, url, resolver, reader, addDependency }) {
  let urlResolved;

  try {
    urlResolved = await resolver(context, urlToRequest(url, true));
  } catch (error) {
    const resolveError = new Error(`Cannot find '${url}': ${error}`);
    resolveError.type = 'resolveError';
    throw resolveError;
  }

  addDependency(urlResolved);

  const content = await reader(urlResolved);

  return { source: url, content: content.toString(), urlResolved };
}

export {
  flattenSourceMap,
  getContentFromSourcesContent,
  isUrlRequest,
  getSourceMappingUrl,
  getUrlContent,
  errorsHandle,
};
