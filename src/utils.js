import fs from 'fs';

import sourceMap from 'source-map';

async function flattenSourceMap(map) {
  const consumer = await new sourceMap.SourceMapConsumer(map);
  let generatedMap;

  if (map.file) {
    generatedMap = new sourceMap.SourceMapGenerator({
      file: map.file,
    });
  } else {
    generatedMap = new sourceMap.SourceMapGenerator();
  }

  consumer.sources.forEach((sourceFile) => {
    const sourceContent = consumer.sourceContentFor(sourceFile, true);
    generatedMap.setSourceContent(sourceFile, sourceContent);
  });

  consumer.eachMapping((mapping) => {
    const { source } = consumer.originalPositionFor({
      line: mapping.generatedLine,
      column: mapping.generatedColumn,
    });

    const mappings = {
      source,
      original: {
        line: mapping.originalLine,
        column: mapping.originalColumn,
      },
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
    };

    if (source) {
      generatedMap.addMapping(mappings);
    }
  });

  return generatedMap.toJSON();
}

function normalize(path) {
  return path.replace(/\\/g, '/');
}

function readFile(fullPath, charset, emitWarning) {
  return new Promise((resolve) => {
    fs.readFile(fullPath, charset, (readFileError, content) => {
      if (readFileError) {
        emitWarning(`Cannot open source file '${fullPath}': ${readFileError}`);

        resolve({ source: fullPath, content: null });
      }

      resolve({ source: fullPath, content });
    });
  });
}

class MapAgregator {
  constructor({ mapConsumer, source, fullPath, emitWarning }) {
    this.fullPath = fullPath;
    this.sourceContent = mapConsumer.sourceContentFor(source, true);
    this.emitWarning = emitWarning;
  }

  setFullPath(path) {
    this.fullPath = path;
  }

  get content() {
    return this.sourceContent
      ? { source: this.fullPath, content: this.sourceContent }
      : readFile(this.fullPath, 'utf-8', this.emitWarning);
  }

  get placeholderContent() {
    return this.sourceContent
      ? { source: this.fullPath, content: this.sourceContent }
      : { source: this.fullPath, content: null };
  }
}

export { flattenSourceMap, normalize, MapAgregator };
