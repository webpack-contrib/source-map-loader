/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import path from 'path';

import validateOptions from 'schema-utils';
import { getOptions } from 'loader-utils';

import schema from './options.json';
import { getSourceMappingURL, fetchFromURL, flattenSourceMap } from './utils';

export default async function loader(input, inputMap) {
  const options = getOptions(this);

  validateOptions(schema, options, {
    name: 'Source Map Loader',
    baseDataPath: 'options',
  });

  const { skipResource } = options;

  const { sourceMappingURL, replacementString } = getSourceMappingURL(input);
  const callback = this.async();

  const shouldSuppress =
    sourceMappingURL && skipResource && skipResource(this, sourceMappingURL);

  if (!sourceMappingURL || shouldSuppress) {
    callback(null, input, inputMap);

    return;
  }

  let sourceURL;
  let sourceContent;

  try {
    ({ sourceURL, sourceContent } = await fetchFromURL(
      this,
      this.context,
      sourceMappingURL
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
      new Error(`Failed to parse source map from '${sourceURL}': ${parseError}`)
    );

    callback(null, input, inputMap);

    return;
  }

  const context = sourceURL ? path.dirname(sourceURL) : this.context;

  if (map.sections) {
    // eslint-disable-next-line no-param-reassign
    map = await flattenSourceMap(map);
  }

  const resolvedSources = await Promise.all(
    map.sources.map(async (source, i) => {
      // eslint-disable-next-line no-shadow
      let sourceURL;
      // eslint-disable-next-line no-shadow
      let sourceContent;

      const originalSourceContent =
        map.sourcesContent && map.sourcesContent[i]
          ? map.sourcesContent[i]
          : null;
      const skipReading = originalSourceContent !== null;

      // We do not skipReading here, because we need absolute paths in sources.
      // This is necessary so that for sourceMaps with the same file structure in sources, name collisions do not occur.
      // https://github.com/webpack-contrib/source-map-loader/issues/51
      try {
        ({ sourceURL, sourceContent } = await fetchFromURL(
          this,
          context,
          source,
          map.sourceRoot,
          skipReading
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

    newMap.sources.push(sourceURL || '');
    newMap.sourcesContent.push(sourceContent || '');
  });

  const sourcesContentIsEmpty =
    newMap.sourcesContent.filter((entry) => Boolean(entry)).length === 0;

  if (sourcesContentIsEmpty) {
    delete newMap.sourcesContent;
  }

  callback(null, input.replace(replacementString, ''), newMap);
}
