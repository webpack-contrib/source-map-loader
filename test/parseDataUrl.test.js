import parseDataUrl from "../src/parse-data-url";

import dataUrls from "./fixtures/json/data-urls.json";

describe("parse-data-url", () => {
  dataUrls.forEach((entry) => {
    it(`should work with "${entry}" url`, async () => {
      const [url, expected] = entry;

      const result = parseDataUrl(url);

      if (result === null) {
        expect(result).toBe(expected);
      } else {
        expect(result.mimeType.toString()).toEqual(expected[0]);
        expect(result.body).toEqual(Buffer.from(expected[1]));
      }
    });
  });
});
