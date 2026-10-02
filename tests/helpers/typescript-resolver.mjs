// Node's type stripping needs extensions; the app uses Next.js bundler resolution.
export async function resolve(specifier, context, nextResolve) {
  // Match the CommonJS interop that Next.js provides for Transbank's named imports.
  if (specifier === "transbank-sdk") {
    const resolved = await nextResolve(specifier, context);
    const source = `import sdk from ${JSON.stringify(resolved.url)}; export const { Environment, IntegrationApiKeys, IntegrationCommerceCodes, Options, WebpayPlus } = sdk;`;
    return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  }
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (/^\.\.?\//.test(specifier) && !/\.[^/]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    throw error;
  }
}
