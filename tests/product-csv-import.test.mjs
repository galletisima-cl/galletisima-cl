import assert from "node:assert/strict";
import test from "node:test";
import { parseProductCsv } from "../lib/product-csv-import.ts";

const headers = "Permalink,Name,Description,Meta Title,Meta Description,Width,Length,Height,Brand,Barcode,Categories,Images,Digital,Featured,Status,SKU,Weight,Cost per item,Compare at price,Stock,Stock Unlimited,Stock Notification,Stock Threshold,Price,Quotable,Minimum Quantity,Maximum Quantity,Variant Image,Variant 1 Option Name,Variant 1 Option Type,Variant 1 Option Value,Variant 1 Option Custom,Google Product Category";

test("imports a Jumpseller product row followed by size variants", () => {
  const csv = [
    headers,
    'cutter-test,Producto prueba,,,Producto prueba,0.0,0.0,0.0,,,"Categoría A, Categoría B",,NO,NO,available,SKUTEST001,1.0,,,0,YES,NO,0,1500.0,NO,,,,,,,,',
    "cutter-test,,,,,,,,,,,,,,,SKUTEST001,1.0,,,0,YES,NO,0,1600.0,,,,,Tamaño,option,6 cm,,",
    "cutter-test,,,,,,,,,,,,,,,SKUTEST001,1.0,,,0,YES,NO,0,2000.0,,,,,Tamaño,option,8 cm,,",
  ].join("\n");

  const result = parseProductCsv(csv);

  assert.deepEqual(result.errors, []);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].price, 1600);
  assert.deepEqual(result.products[0].categories, ["Categoría A", "Categoría B"]);
  assert.deepEqual(result.products[0].sizes, ["6 cm", "8 cm"]);
  assert.deepEqual(result.products[0].sizePrices, { "6 cm": 1600, "8 cm": 2000 });
  assert.equal(result.products[0].stock, 999999);
});

test("keeps the product price when the file has no variants", () => {
  const csv = [
    headers,
    "simple-product,Producto simple,,,,,,,,,Categoría A,,NO,NO,available,SKUSIMPLE001,,,,12,NO,NO,0,1750.0,NO,,,,,,,,",
  ].join("\n");

  const result = parseProductCsv(csv);

  assert.deepEqual(result.errors, []);
  assert.equal(result.products[0].price, 1750);
  assert.equal(result.products[0].stock, 12);
});
