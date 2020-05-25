export default (map) => {
  const result = map;

  if (result.sources) {
    result.sources = normalizeArr(result.sources);
  }

  if (result.file) {
    [result.file] = normalizeArr([result.file]);
  }

  if (result.sourceRoot) {
    [result.sourceRoot] = normalizeArr([result.sourceRoot]);
  }

  return result;
};

function normalizeArr(arr) {
  return arr.map((str) => {
    const normilized = removeCWD(str);

    if (str === normilized) {
      return str;
    }

    if (str.replace(/\\/g, '/') === normilized) {
      return normilized;
    }

    return `${normilized} - (normalized for test)`;
  });
}

function removeCWD(str) {
  const isWin = process.platform === 'win32';
  let cwd = process.cwd();

  if (isWin) {
    // eslint-disable-next-line no-param-reassign
    str = str.replace(/\\/g, '/');
    cwd = cwd.replace(/\\/g, '/');
  }

  return str.replace(new RegExp(cwd, 'g'), '');
}
