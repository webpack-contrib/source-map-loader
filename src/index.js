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

  let sourceURL;
  let sourceContent;

  try {
    ({ sourceURL, sourceContent } = await fetchFromURL(
      this,
      this.context,
      url
    ));
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

  const context = sourceURL ? path.dirname(sourceURL) : this.context;

  if (map.sections) {
    // eslint-disable-next-line no-param-reassign
    map = await flattenSourceMap(map);
  }

  const mapConsumer = await new SourceMapConsumer(map);
  const resolvedSources = await Promise.all(
    map.sources.map(async (source) => {
      // eslint-disable-next-line no-shadow
      let sourceURL;
      // eslint-disable-next-line no-shadow
      let sourceContent;

      const originalSourceContent = mapConsumer.sourceContentFor(source, true);

      try {
        ({ sourceURL, sourceContent } = await fetchFromURL(
          this,
          context,
          source,
          map.sourceRoot,
          originalSourceContent !== null
        ));
      } catch (error) {
        this.emitWarning(error);

        sourceURL = source;
      }

      if (originalSourceContent) {
        sourceContent = originalSourceContent;
      }

      if (sourceURL) {
        this.addDependency(sourceURL);
      }

      return { sourceURL, sourceContent };
    })
  );

  const newMap = { ...map };

  newMap.sources = [];
  newMap.sourcesContent = [];

  delete newMap.sourceRoot;

  resolvedSources.forEach((source) => {
    // eslint-disable-next-line no-shadow
    const { sourceURL, sourceContent } = source;

    if (sourceURL) {
      newMap.sources.push(sourceURL);
    } else {
      newMap.sources.push('');
    }

    newMap.sourcesContent.push(sourceContent);
  });

  const sourcesContentIsEmpty =
    newMap.sourcesContent.filter((entry) => Boolean(entry)).length === 0;

  if (sourcesContentIsEmpty) {
    delete newMap.sourcesContent;
  }

  callback(null, input.replace(replacementString, ''), newMap);
}
