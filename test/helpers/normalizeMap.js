export default (map) => {
  const result = map;

  if (result.sources) {
    result.sources = normilizeArr(result.sources);
  }

  if (result.file) {
    [result.file] = normilizeArr([result.file]);
  }

  if (result.sourceRoot) {
    [result.sourceRoot] = normilizeArr([result.sourceRoot]);
  }

  return result;
};

function normilizeArr(arr) {
  return arr.map((str) => {
    const normilized = removeCWD(str);

    if (str === normilized) {
      return str;
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
