/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import path from "node:path";

import schema from "./options.json";
import {
  fetchFromURL,
  flattenSourceMap,
  getSourceMappingURL,
  isURL,
} from "./utils";

export default async function loader(input, inputMap) {
  const options = this.getOptions(schema);
  const { sourceMappingURL, replacementString } = getSourceMappingURL(input);
  const callback = this.async();

  if (!sourceMappingURL) {
    callback(null, input, inputMap);

    return;
  }

  let behaviourSourceMappingUrl;

  try {
    behaviourSourceMappingUrl =
      typeof options.filterSourceMappingUrl !== "undefined"
        ? options.filterSourceMappingUrl(sourceMappingURL, this.resourcePath)
        : "consume";
  } catch (error) {
    callback(error);

    return;
  }

  switch (behaviourSourceMappingUrl) {
    case "skip":
      callback(null, input, inputMap);
      return;
    case false:
    case "remove":
      callback(null, input.replace(replacementString, ""), inputMap);
      return;
  }

  let sourceURL;
  let sourceContent;

  try {
    ({ sourceURL, sourceContent } = await fetchFromURL(
      this,
      this.context,
      sourceMappingURL,
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
    map = JSON.parse(sourceContent.replace(/^\)\]\}'/, ""));
  } catch (err) {
    this.emitWarning(
      new Error(
        `Failed to parse source map from '${sourceMappingURL}': ${err}`,
        { cause: err },
      ),
    );

    callback(null, input, inputMap);

    return;
  }

  const context = sourceURL ? path.dirname(sourceURL) : this.context;

  if (map.sections) {
    map = await flattenSourceMap(map);
  }

  const resolvedSources = await Promise.all(
    map.sources.map(async (source, i) => {
      let sourceURL;

      let sourceContent;

      const originalSourceContent =
        map.sourcesContent &&
        typeof map.sourcesContent[i] !== "undefined" &&
        map.sourcesContent[i] !== null
          ? map.sourcesContent[i]
          : undefined;
      const skipReading = typeof originalSourceContent !== "undefined";
      let errored = false;

      // We do not skipReading here, because we need absolute paths in sources.
      // This is necessary so that for sourceMaps with the same file structure in sources, name collisions do not occur.
      // https://github.com/webpack-contrib/source-map-loader/issues/51
      try {
        ({ sourceURL, sourceContent } = await fetchFromURL(
          this,
          context,
          source,
          map.sourceRoot,
          skipReading,
        ));
      } catch (error) {
        errored = true;

        this.emitWarning(error);
      }

      if (skipReading) {
        sourceContent = originalSourceContent;
      } else if (!errored && sourceURL && !isURL(sourceURL)) {
        this.addDependency(sourceURL);
      }

      // Return original value of `source` when error happens
      return { sourceURL: errored ? source : sourceURL, sourceContent };
    }),
  );

  const newMap = { ...map };

  newMap.sources = [];
  newMap.sourcesContent = [];

  delete newMap.sourceRoot;

  for (const source of resolvedSources) {
    const { sourceURL, sourceContent } = source;

    newMap.sources.push(sourceURL || "");
    newMap.sourcesContent.push(sourceContent || "");
  }

  const sourcesContentIsEmpty =
    newMap.sourcesContent.filter(Boolean).length === 0;

  if (sourcesContentIsEmpty) {
    delete newMap.sourcesContent;
  }

  callback(null, input.replace(replacementString, ""), newMap);
}
