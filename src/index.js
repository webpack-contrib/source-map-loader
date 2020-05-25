/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
import path from 'path';

import validateOptions from 'schema-utils';

import { SourceMapConsumer } from 'source-map';

import { getOptions } from 'loader-utils';

import schema from './options.json';
import {
  flattenSourceMap,
  getContentFromSourcesContent,
  getSourceMappingUrl,
  getUrlContent,
  errorsHandle,
} from './utils';

export default async function loader(input, inputMap) {
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'Source Map Loader',
    baseDataPath: 'options',
  });

  const { fetchReader } = options;
  const { url } = getSourceMappingUrl(input);
  const { replacementString } = getSourceMappingUrl(input);
  const callback = this.async();

  if (!url) {
    callback(null, input, inputMap);

    return;
  }

  const { context, emitWarning, addDependency } = this;
  const loaderContext = this;

  let rawMap;

  try {
    rawMap = await getUrlContent({
      context,
      url,
      fetchReader,
      loaderContext,
    });
  } catch (error) {
    errorsHandle(error, loaderContext);

    callback(null, input, inputMap);

    return;
  }

  const { content: mapExtracted, urlResolved } = rawMap;

  let map;

  try {
    map = JSON.parse(mapExtracted.replace(/^\)\]\}'/, ''));
  } catch (parseError) {
    emitWarning(`Cannot parse SourceMap '${url}': ${parseError}`);

    callback(null, input, inputMap);

    return;
  }

  const newContext = urlResolved ? path.dirname(urlResolved) : context;

  processMap(map, newContext, callback);

  // eslint-disable-next-line no-shadow
  async function processMap(map, context, callback) {
    if (map.sections) {
      // eslint-disable-next-line no-param-reassign
      map = await flattenSourceMap(map);
    }

    const mapConsumer = await new SourceMapConsumer(map);

    const resolvedSources = await Promise.all(
      map.sources.map(async (source) => {
        const fullPath = map.sourceRoot
          ? `${map.sourceRoot}${path.sep}${source}`
          : source;

        const originalData = getContentFromSourcesContent(mapConsumer, source);

        let sourceContent;

        try {
          sourceContent = await getUrlContent({
            context,
            url: fullPath,
            fetchReader,
            loaderContext,
            originalData,
          });
        } catch (error) {
          errorsHandle(error, loaderContext);

          return originalData
            ? {
                source,
                content: originalData,
              }
            : { source, content: null };
        }

        const { content, urlResolved: sourceResolved } = sourceContent;

        return originalData
          ? {
              source: sourceResolved || fullPath,
              content: originalData,
            }
          : { source: sourceResolved || fullPath, content };
      })
    );

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
