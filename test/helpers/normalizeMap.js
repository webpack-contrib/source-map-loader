function removeCWD(str) {
  const isWin = process.platform === "win32";
  let cwd = process.cwd();

  if (isWin) {
    str = str.replaceAll("\\", "/");
    cwd = cwd.replaceAll("\\", "/");
  }

  return str.replaceAll(new RegExp(cwd, "g"), "");
}

function normalizeArr(arr) {
  return arr.map((str) => {
    const normilized = removeCWD(str);

    if (str === normilized) {
      return str;
    }

    if (str.replaceAll("\\", "/") === normilized) {
      return normilized;
    }

    return `${normilized} - (normalized for test)`;
  });
}

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
