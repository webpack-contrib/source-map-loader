/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
import fs from 'fs';
import path from 'path';
import urlUtils from 'url';

import validateOptions from 'schema-utils';
import parseDataURL from 'data-urls';

import { SourceMapConsumer } from 'source-map';
import { labelToName, decode } from 'whatwg-encoding';
import { getOptions, urlToRequest } from 'loader-utils';

import schema from './options.json';
import {
  flattenSourceMap,
  readFile,
  getContentFromSourcesContent,
  isUrlRequest,
  getSourceMappingUrl,
  reportUnresolveSource,
} from './utils';

export default function loader(input, inputMap) {
  const { context, resolve, addDependency } = this;
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'Source Map Loader',
    baseDataPath: 'options',
  });

  const reportMessage = reportUnresolveSource(
    this,
    options.unresolvedSourceReport
  );

  let { url } = getSourceMappingUrl(input);
  const { replacementString } = getSourceMappingUrl(input);
  const callback = this.async();

  if (!url) {
    callback(null, input, inputMap);

    return;
  }

  const dataURL = parseDataURL(url);

  if (dataURL) {
    let map;

    try {
      dataURL.encodingName =
        labelToName(dataURL.mimeType.parameters.get('charset')) || 'UTF-8';

      map = decode(dataURL.body, dataURL.encodingName);
      map = JSON.parse(map.replace(/^\)\]\}'/, ''));
    } catch (error) {
      reportMessage(
        `Cannot parse inline SourceMap with Charset ${dataURL.encodingName}: ${error}`
      );

      callback(null, input, inputMap);

      return;
    }

    processMap(map, context, callback);

    return;
  }

  if (url.toLowerCase().indexOf('data:') === 0) {
    reportMessage(`Cannot parse inline SourceMap: ${url}`);

    callback(null, input, inputMap);

    return;
  }

  if (!isUrlRequest(url)) {
    const { protocol } = urlUtils.parse(url);

    if (protocol !== 'file:') {
      reportMessage(`URL scheme not supported: ${protocol}`);

      callback(null, input, inputMap);

      return;
    }

    try {
      url = urlUtils.fileURLToPath(url);
    } catch (error) {
      reportMessage(error);

      callback(null, input, inputMap);

      return;
    }
  }

  resolve(context, urlToRequest(url, true), (resolveError, result) => {
    if (resolveError) {
      reportMessage(`Cannot find SourceMap '${url}': ${resolveError}`);

      callback(null, input, inputMap);

      return;
    }

    addDependency(result);

    fs.readFile(result, 'utf-8', (readFileError, content) => {
      if (readFileError) {
        reportMessage(`Cannot open SourceMap '${result}': ${readFileError}`);

        callback(null, input, inputMap);

        return;
      }

      let map;

      try {
        map = JSON.parse(content);
      } catch (e) {
        reportMessage(`Cannot parse SourceMap '${url}': ${e}`);

        callback(null, input, inputMap);

        return;
      }

      processMap(map, path.dirname(result), callback);
    });
  });

  // eslint-disable-next-line no-shadow
  async function processMap(map, context, callback) {
    if (map.sections) {
      // eslint-disable-next-line no-param-reassign
      map = await flattenSourceMap(map);
    }

    const mapConsumer = await new SourceMapConsumer(map);

    let resolvedSources;

    try {
      resolvedSources = await Promise.all(
        map.sources.map(async (source) => {
          const fullPath = map.sourceRoot
            ? `${map.sourceRoot}${path.sep}${source}`
            : source;

          const originalData = getContentFromSourcesContent(
            mapConsumer,
            source
          );

          if (path.isAbsolute(fullPath)) {
            return originalData
              ? { source: fullPath, content: originalData }
              : readFile(fullPath, 'utf-8', reportMessage);
          }

          return new Promise((promiseResolve) => {
            resolve(
              context,
              urlToRequest(fullPath, true),
              (resolveError, result) => {
                if (resolveError) {
                  reportMessage(
                    `Cannot find source file '${source}': ${resolveError}`
                  );

                  return originalData
                    ? promiseResolve({
                        source: fullPath,
                        content: originalData,
                      })
                    : promiseResolve({ source: fullPath, content: null });
                }

                return originalData
                  ? promiseResolve({ source: result, content: originalData })
                  : promiseResolve(readFile(result, 'utf-8', reportMessage));
              }
            );
          });
        })
      );
    } catch (error) {
      reportMessage(error);

      callback(null, input, inputMap);
    }

    const resultMap = { ...map };
    resultMap.sources = [];
    resultMap.sourcesContent = [];

    delete resultMap.sourceRoot;

    resolvedSources.forEach((res) => {
      // eslint-disable-next-line no-param-reassign
      resultMap.sources.push(path.normalize(res.source));
      resultMap.sourcesContent.push(res.content);

      if (res.source) {
        addDependency(res.source);
      }
    });

    const sourcesContentIsEmpty =
      resultMap.sourcesContent.filter((entry) => !!entry).length === 0;

    if (sourcesContentIsEmpty) {
      delete resultMap.sourcesContent;
    }

    callback(null, input.replace(replacementString, ''), resultMap);
  }
}
