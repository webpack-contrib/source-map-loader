import { getSourceMappingUrl } from '../src/utils';

describe('source-map-loader', () => {
  it('should work', async () => {
    const code = `/*#sourceMappingURL=absolute-sourceRoot-source-map.map*/`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `/*  #sourceMappingURL=absolute-sourceRoot-source-map.map  */`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `//#sourceMappingURL=absolute-sourceRoot-source-map.map`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `//@sourceMappingURL=absolute-sourceRoot-source-map.map`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = ` //  #sourceMappingURL=absolute-sourceRoot-source-map.map`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = ` //  #  sourceMappingURL  =   absolute-sourceRoot-source-map.map  `;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `// #sourceMappingURL = http://sampledomain.com/external-source-map2.map`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `// #sourceMappingURL = //sampledomain.com/external-source-map2.map`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `// @sourceMappingURL=data:application/source-map;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lLXNvdXJjZS1tYXAuanMiLCJzb3VyY2VzIjpbImlubGluZS1zb3VyY2UtbWFwLnR4dCJdLCJzb3VyY2VzQ29udGVudCI6WyJ3aXRoIFNvdXJjZU1hcCJdLCJtYXBwaW5ncyI6IkFBQUEifQ==`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should work', async () => {
    const code = `
    with SourceMap
    
    // #sourceMappingURL = /sample-source-map.map
    // comment
    `;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should find last map', async () => {
    const code = `
    with SourceMap
    // #sourceMappingURL = /sample-source-map-1.map
    // #sourceMappingURL = /sample-source-map-2.map
    // #sourceMappingURL = /sample-source-map-last.map
    // comment
    `;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should be null', async () => {
    const code = `"
    /*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))))+" */";`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should be null', async () => {
    const code = `anInvalidDirective = "\\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))))+" */";`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });

  it('should not include quotes', async () => {
    const code = `// # sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))))+"`;
    const { url } = getSourceMappingUrl(code);

    expect(url).toMatchSnapshot('result');
  });
});
