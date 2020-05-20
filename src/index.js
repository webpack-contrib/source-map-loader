/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
import fs from 'fs';
import path from 'path';

import validateOptions from 'schema-utils';
import async from 'neo-async';
import parseDataURL from 'data-urls';
import sourceMap from 'source-map';
import { labelToName, decode } from 'whatwg-encoding';
import { getOptions, urlToRequest } from 'loader-utils';
import { isAbsolute } from 'source-map/lib/util';

import schema from './options.json';
import { flattenSourceMap, readFile, normalize } from './utils';

// Matches only the last occurrence of sourceMappingURL
const baseRegex =
  '\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)(?![\\S\\s]*sourceMappingURL)';
// Matches /* ... */ comments
const regex1 = new RegExp(`/\\*${baseRegex}\\s*\\*/`);
// Matches // .... comments
const regex2 = new RegExp(`//${baseRegex}($|\n|\r\n?)`);

export default function loader(input, inputMap) {
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'Source Map Loader',
    baseDataPath: 'options',
  });

  const match = input.match(regex1) || input.match(regex2);
  const callback = this.async();

  if (!match) {
    callback(null, input, inputMap);

    return;
  }

  const [, url] = match;

  const dataURL = parseDataURL(url);

  const { context, resolve, addDependency, emitWarning } = this;

  if (dataURL) {
    let map;

    try {
      dataURL.encodingName =
        labelToName(dataURL.mimeType.parameters.get('charset')) || 'UTF-8';

      map = decode(dataURL.body, dataURL.encodingName);
      map = JSON.parse(map);
    } catch (error) {
      emitWarning(
        `Cannot parse inline SourceMap with Charset ${dataURL.encodingName}: ${error}`
      );

      callback(null, input, inputMap);

      return;
    }

    processMap(map, context, callback);

    return;
  }

  if (url.toLowerCase().indexOf('data:') === 0) {
    emitWarning(`Cannot parse inline SourceMap: ${url}`);

    callback(null, input, inputMap);

    return;
  }

  resolve(context, urlToRequest(url, true), (resolveError, result) => {
    if (resolveError) {
      emitWarning(`Cannot find SourceMap '${url}': ${resolveError}`);

      callback(null, input, inputMap);

      return;
    }

    addDependency(result);

    fs.readFile(result, 'utf-8', (readFileError, content) => {
      if (readFileError) {
        emitWarning(`Cannot open SourceMap '${result}': ${readFileError}`);

        callback(null, input, inputMap);

        return;
      }

      let map;

      try {
        map = JSON.parse(content);
      } catch (e) {
        emitWarning(`Cannot parse SourceMap '${url}': ${e}`);

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

    const originalMap = await new sourceMap.SourceMapConsumer(map);

    async.map(
      map.sources,
      // eslint-disable-next-line no-shadow
      (source, callback) => {
        const fullPath = map.sourceRoot
          ? `${map.sourceRoot}/${source}`
          : source;

        if (isAbsolute(fullPath)) {
          const sourceContent = originalMap.sourceContentFor(source, true);

          if (sourceContent) {
            callback(null, { source: fullPath, content: sourceContent });
            return;
          }

          readFile(fullPath, 'utf-8', callback, emitWarning);
          return;
        }

        resolve(
          context,
          urlToRequest(fullPath, true),
          (resolveError, result) => {
            if (resolveError) {
              emitWarning(
                `Cannot find source file '${source}': ${resolveError}`
              );

              callback(null, null);

              return;
            }

            readFile(result, 'utf-8', callback, emitWarning);
          }
        );
      },
      (err, info) => {
        const resultMap = { ...map };
        resultMap.sources = [];
        resultMap.sourcesContent = [];

        delete resultMap.sourceRoot;

        info.forEach((res) => {
          if (res) {
            // eslint-disable-next-line no-param-reassign
            resultMap.sources.push(normalize(res.source));
            resultMap.sourcesContent.push(res.content);

            if (res.source) {
              addDependency(res.source);
            }
          }
        });

        if (resultMap.sources.length === 0) {
          callback(null, input, map);
          return;
        }

        callback(null, input.replace(match[0], ''), resultMap);
      }
    );
  }
}
