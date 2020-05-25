/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import path from 'path';

import validateOptions from 'schema-utils';
import parseDataURL from 'data-urls';

import { SourceMapConsumer } from 'source-map';

import { labelToName, decode } from 'whatwg-encoding';
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
        this.emitWarning(
          `Cannot parse inline SourceMap with Charset ${dataURL.encodingName}: ${error}`
        );

        callback(null, input, inputMap);

        return;
      }

      processMap(map, this.context, callback);

      return;
    }

    this.emitWarning(`Cannot parse inline SourceMap: ${url}`);

    callback(null, input, inputMap);

    return;
  }

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

  this.addDependency(sourceURL);

  let map;

  try {
    map = JSON.parse(sourceContent.replace(/^\)\]\}'/, ''));
  } catch (parseError) {
    this.emitWarning(
      `Cannot parse source map from '${sourceURL}': ${parseError}`
    );

    callback(null, input, inputMap);

    return;
  }

  processMap(map, path.dirname(sourceURL), callback);

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

          loaderContext.addDependency(sourceURL);

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
