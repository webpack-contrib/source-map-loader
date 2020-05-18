import sourceMap from 'source-map';

async function FlattenSourceMap(map) {
  const consumer = await new sourceMap.SourceMapConsumer(map);
  let generatedMap;

  if (map.file) {
    generatedMap = new sourceMap.SourceMapGenerator({
      file: map.file || '',
    });
  } else {
    generatedMap = new sourceMap.SourceMapGenerator();
  }

  consumer.sources.forEach(function (sourceFile) {
    const sourceContent = consumer.sourceContentFor(sourceFile);

    generatedMap.setSourceContent(sourceFile, sourceContent);
  });

  consumer.eachMapping(function (m) {
    const { source } = consumer.originalPositionFor({
      line: m.generatedLine,
      column: m.generatedColumn,
    });

    const mapping = {
      source,
      original: {
        line: m.originalLine,
        column: m.originalColumn,
      },
      generated: {
        line: m.generatedLine,
        column: m.generatedColumn,
      },
    };

    if (source) {
      generatedMap.addMapping(mapping);
    }
  });

  return generatedMap.toJSON();
}

module.exports = FlattenSourceMap;
