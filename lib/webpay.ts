import {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} from "transbank-sdk";

const isProduction = process.env.WEBPAY_ENVIRONMENT === "production";

export function getWebpayTransaction() {
  if (isProduction) {
    const commerceCode = process.env.WEBPAY_COMMERCE_CODE;
    const apiKey = process.env.WEBPAY_API_KEY;
    if (!commerceCode || !apiKey) {
      throw new Error("Faltan WEBPAY_COMMERCE_CODE y WEBPAY_API_KEY para usar Webpay en producción.");
    }
    return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, Environment.Production));
  }

  return new WebpayPlus.Transaction(
    new Options(
      IntegrationCommerceCodes.WEBPAY_PLUS,
      IntegrationApiKeys.WEBPAY,
      Environment.Integration,
    ),
  );
}

export function getWebpayEnvironment() {
  return isProduction ? "production" : "integration";
}
