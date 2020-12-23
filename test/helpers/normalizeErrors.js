function removeCWD(str) {
  const isWin = process.platform === "win32";
  let cwd = process.cwd();

  if (isWin) {
    // eslint-disable-next-line no-param-reassign
    str = str.replace(/\\/g, "/");
    // eslint-disable-next-line no-param-reassign
    cwd = cwd.replace(/\\/g, "/");
  }

  return str
    .replace(/\(from .*?\)/, "(from `replaced original path`)")
    .replace(new RegExp(cwd, "g"), "");
}

export default (errors, shortError) =>
  errors.map((error) => {
    let errorMessage = error.toString();

    if (shortError) {
      errorMessage = errorMessage.split("\n").slice(0, 1).join("\n");
    }

    return removeCWD(errorMessage.split("\n").slice(0, 2).join("\n"));
  });
