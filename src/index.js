/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import path from 'path';

import { promisify } from 'util';

import validateOptions from 'schema-utils';
import parseDataURL from 'data-urls';

import { SourceMapConsumer } from 'source-map';

import { labelToName, decode } from 'whatwg-encoding';
import { getOptions, urlToRequest } from 'loader-utils';

import schema from './options.json';
import {
  flattenSourceMap,
  getSourceMappingUrl,
  getRequestedUrl,
  getAbsolutePathToSource,
} from './utils';

export default async function loader(input, inputMap) {
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'Source Map Loader',
    baseDataPath: 'options',
  });

  let { url } = getSourceMappingUrl(input);
  const { replacementString } = getSourceMappingUrl(input);
  const callback = this.async();

  if (!url) {
    callback(null, input, inputMap);

    return;
  }

  const { fs, context, addDependency, emitWarning } = this;
  const readFile = promisify(fs.readFile).bind(fs);

  if (url.toLowerCase().startsWith('data:')) {
    const dataURL = parseDataURL(url);

    if (dataURL) {
      let map;

      try {
        dataURL.encodingName =
          labelToName(dataURL.mimeType.parameters.get('charset')) || 'UTF-8';

        map = decode(dataURL.body, dataURL.encodingName);
        map = JSON.parse(map.replace(/^\)\]\}'/, ''));
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

    emitWarning(`Cannot parse inline SourceMap: ${url}`);

    callback(null, input, inputMap);

    return;
  }

  try {
    url = getRequestedUrl(url);
  } catch (error) {
    emitWarning(error.message);

    callback(null, input, inputMap);

    return;
  }

  const absolutePathToSourceMappingURL = path.isAbsolute(url)
    ? url
    : path.join(context, urlToRequest(url, true));

  addDependency(absolutePathToSourceMappingURL);

  let buffer;

  try {
    buffer = await readFile(absolutePathToSourceMappingURL);
  } catch (error) {
    emitWarning(`Cannot read '${url}' file from source map URL: ${error}`);

    callback(null, input, inputMap);

    return;
  }

  let map;

  try {
    map = JSON.parse(buffer.toString());
  } catch (parseError) {
    emitWarning(`Cannot parse SourceMap '${url}': ${parseError}`);

    callback(null, input, inputMap);

    return;
  }

  processMap(map, path.dirname(absolutePathToSourceMappingURL), callback);

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
          const absolutePath = getAbsolutePathToSource(context, source, map);
          const originalContent = mapConsumer.sourceContentFor(source, true);

          if (originalContent) {
            return { source: absolutePath, content: originalContent };
          }

          // eslint-disable-next-line no-shadow
          let content;

          try {
            // eslint-disable-next-line no-shadow
            const buffer = await readFile(absolutePath);

            content = buffer.toString();
          } catch (error) {
            emitWarning(`Cannot read source file '${source}': ${error}`);
          }

          return { source: absolutePath, content };
        })
      );
    } catch (error) {
      emitWarning(error);

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
