import parseDataUrl from '../src/parse-data-url';

import dataUrls from './fixtures/json/data-urls.json';

describe('parse-data-url', () => {
  dataUrls.forEach((entry) => {
    it(`should work with "${entry}" url`, async () => {
      const [url, mimeType, value] = entry;

      const result = parseDataUrl(url);

      if (mimeType) {
        expect(mimeType).toEqual(result.mimeType.toString());
      }

      if (value) {
        const body = result.body.toJSON().data;

        value.forEach((item, index) => {
          expect(value[index]).toEqual(body[index]);
        });
      } else {
        expect(result).toEqual(null);
      }
    });
  });
});
