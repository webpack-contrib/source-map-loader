/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
import fs from 'fs';
import path from 'path';

import validateOptions from 'schema-utils';
import async from 'neo-async';
import { getOptions, urlToRequest } from 'loader-utils';

import schema from './options.json';

// Matches only the last occurrence of sourceMappingURL
const baseRegex =
  '\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)(?![\\S\\s]*sourceMappingURL)';
// Matches /* ... */ comments
const regex1 = new RegExp(`/\\*${baseRegex}\\s*\\*/`);
// Matches // .... comments
const regex2 = new RegExp(`//${baseRegex}($|\n|\r\n?)`);
// Matches DataUrls
const regexDataUrl = /data:[^;\n]+(?:;charset=[^;\n]+)?;base64,([a-zA-Z0-9+/]+={0,2})/;

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
  const dataUrlMatch = regexDataUrl.exec(url);
  const { context, resolve, addDependency, emitWarning } = this;

  if (dataUrlMatch) {
    const [, mapBase64] = dataUrlMatch;
    const mapStr = new Buffer(mapBase64, 'base64').toString();

    let map;

    try {
      map = JSON.parse(mapStr);
    } catch (error) {
      emitWarning(
        `Cannot parse inline SourceMap '${mapBase64.substr(0, 50)}': ${error}`
      );

      callback(null, input, inputMap);

      return;
    }

    processMap(map, context, callback);
  } else {
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
  }

  // eslint-disable-next-line no-shadow
  function processMap(map, context, callback) {
    if (!map.sourcesContent || map.sourcesContent.length < map.sources.length) {
      const sourcePrefix = map.sourceRoot ? `${map.sourceRoot}/` : '';

      // eslint-disable-next-line no-param-reassign
      map.sources = map.sources.map((s) => sourcePrefix + s);

      // eslint-disable-next-line no-param-reassign
      delete map.sourceRoot;

      const missingSources = map.sourcesContent
        ? map.sources.slice(map.sourcesContent.length)
        : map.sources;

      async.map(
        missingSources,
        // eslint-disable-next-line no-shadow
        (source, callback) => {
          resolve(
            context,
            urlToRequest(source, true),
            (resolveError, result) => {
              if (resolveError) {
                emitWarning(
                  `Cannot find source file '${source}': ${resolveError}`
                );

                callback(null, null);

                return;
              }

              addDependency(result);

              fs.readFile(result, 'utf-8', (readFileError, content) => {
                if (readFileError) {
                  emitWarning(
                    `Cannot open source file '${result}': ${readFileError}`
                  );

                  callback(null, null);

                  return;
                }

                callback(null, { source: result, content });
              });
            }
          );
        },
        (err, info) => {
          // eslint-disable-next-line no-param-reassign
          map.sourcesContent = map.sourcesContent || [];

          info.forEach((res) => {
            if (res) {
              // eslint-disable-next-line no-param-reassign
              map.sources[map.sourcesContent.length] = res.source;
              map.sourcesContent.push(res.content);
            } else {
              map.sourcesContent.push(null);
            }
          });

          processMap(map, context, callback);
        }
      );

      return;
    }

    callback(null, input.replace(match[0], ''), map);
  }
}
