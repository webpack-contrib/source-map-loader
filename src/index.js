/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import path from 'path';

import validateOptions from 'schema-utils';
import { SourceMapConsumer } from 'source-map';
import { getOptions } from 'loader-utils';

import schema from './options.json';
import { getSourceMappingUrl, fetchFromURL, flattenSourceMap } from './utils';

export default async function loader(input, inputMap) {
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'Source Map Loader',
    baseDataPath: 'options',
  });

  const { url, replacementString } = getSourceMappingUrl(input);
  const callback = this.async();

  if (!url) {
    callback(null, input, inputMap);

    return;
  }

  const loaderContext = this;
  const { context } = this;

  let sourceURL;
  let sourceContent;

  try {
    ({ sourceURL, sourceContent } = await fetchFromURL(this, context, url));
  } catch (error) {
    this.emitWarning(error);

    callback(null, input, inputMap);

    return;
  }

  if (sourceURL) {
    this.addDependency(sourceURL);
  }

  let map;

  try {
    map = JSON.parse(sourceContent.replace(/^\)\]\}'/, ''));
  } catch (parseError) {
    this.emitWarning(
      new Error(`Cannot parse source map from '${sourceURL}': ${parseError}`)
    );

    callback(null, input, inputMap);

    return;
  }

  processMap(map, sourceURL ? path.dirname(sourceURL) : context, callback);

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
          // eslint-disable-next-line no-shadow
          let sourceURL;
          // eslint-disable-next-line no-shadow
          let sourceContent;

          const originalSourceContent = mapConsumer.sourceContentFor(
            source,
            true
          );

          try {
            ({ sourceURL, sourceContent } = await fetchFromURL(
              loaderContext,
              context,
              source,
              map.sourceRoot,
              originalSourceContent !== null
            ));
          } catch (error) {
            loaderContext.emitWarning(error);

            sourceURL = source;
          }

          if (originalSourceContent) {
            sourceContent = originalSourceContent;
          }

          if (sourceURL) {
            loaderContext.addDependency(sourceURL);
          }

          return { sourceURL, sourceContent };
        })
      );
    } catch (error) {
      loaderContext.emitWarning(error);

      callback(null, input, inputMap);
    }

    const resultMap = { ...map };

    resultMap.sources = [];
    resultMap.sourcesContent = [];

    delete resultMap.sourceRoot;

    resolvedSources.forEach((res) => {
      if (res.sourceURL) {
        resultMap.sources.push(res.sourceURL);
      } else {
        resultMap.sources.push('');
      }

      resultMap.sourcesContent.push(res.sourceContent);
    });

    const sourcesContentIsEmpty =
      resultMap.sourcesContent.filter((entry) => !!entry).length === 0;

    if (sourcesContentIsEmpty) {
      delete resultMap.sourcesContent;
    }

    callback(null, input.replace(replacementString, ''), resultMap);
  }
}
