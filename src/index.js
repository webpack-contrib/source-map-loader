import fs from 'fs';
import path from 'path';
import async from 'async';
import loaderUtils from 'loader-utils';

const baseRegex = '\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)';
// Matches /* ... */ comments
const regex1 = new RegExp(`/\\*${baseRegex}\\s*\\*/`);
// Matches // .... comments
const regex2 = new RegExp(`//${baseRegex}($|\n|\r\n?)`);
// Matches DataUrls
const regexDataUrl = /data:[^;\n]+;base64,(.*)/;

export default function(input, inputMap) {
  this.cacheable && this.cacheable();

  const {resolve, addDependency, emitWarning = () => {}} = this;
  const match = input.match(regex1) || input.match(regex2);
  const untouched = (callback) => {
    callback(null, input, inputMap);
  };
  const processMap = (map, context, callback) => {
    if (!map.sourcesContent || map.sourcesContent.length < map.sources.length) {
      const sourcePrefix = map.sourceRoot ? map.sourceRoot + '/' : '';
      map.sources = map.sources.map(source => sourcePrefix + source);
      delete map.sourceRoot;
      const missingSources = map.sourcesContent ? map.sources.slice(map.sourcesContent.length) : map.sources;

      async.map(missingSources, (source, done) => {
        resolve(context, loaderUtils.urlToRequest(source), (err, result) => {
          if (err) {
            emitWarning(`Cannot find source file ${source}: ${err}`);
            return done(null, null);
          }
          addDependency(result);
          fs.readFile(result, 'utf-8', (err, content) => {
            if (err) {
              emitWarning(`Cannot open source file ${result}: ${err}`);
              return done(null, null);
            }
            done(null, {
              source: result,
              content: content
            });
          });
        });
      }, (err, info) => {
        map.sourcesContent = map.sourcesContent || [];
        info.forEach(res => {
          if (res) {
            map.sources[map.sourcesContent.length] = res.source;
            map.sourcesContent.push(res.content);
          } else {
            map.sourcesContent.push(null);
          }
        });
        processMap(map, context, callback);
      });
      return;
    }

    map.sources = map.sources.map(source => path.join(context, path.basename(source)));

    callback(null, input.replace(match[0], ''), map);
  };

  if (match) {
    const url = match[1];
    const dataUrlMatch = regexDataUrl.exec(url);
    const callback = this.async();

    if (dataUrlMatch) {
      const sourceMap = JSON.parse((new Buffer(dataUrlMatch[1], 'base64')).toString());
      processMap(sourceMap, this.context, callback);
    } else {
      resolve(this.context, loaderUtils.urlToRequest(url), (err, result) => {
        if (err) {
          emitWarning(`Cannot find SourceMap ${url}: ${err}`);
          return untouched(callback);
        }
        addDependency(result);
        fs.readFile(result, 'utf-8', (err, content) => {
          if (err) {
            emitWarning(`Cannot open SourceMap ${result}: ${err}`);
            return untouched(callback);
          }
          const sourceMap = JSON.parse(content);
          processMap(sourceMap, path.dirname(result), callback);
        });
      });
    }
  } else {
    return untouched(this.callback);
  }
}
