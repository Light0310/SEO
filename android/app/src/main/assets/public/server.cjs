var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/analyzer.ts
var cheerio = __toESM(require("cheerio"), 1);
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
var STOP_WORDS = /* @__PURE__ */ new Set([
  "the",
  "and",
  "a",
  "to",
  "of",
  "in",
  "is",
  "that",
  "it",
  "on",
  "for",
  "as",
  "with",
  "was",
  "at",
  "by",
  "an",
  "be",
  "this",
  "are",
  "or",
  "from",
  "but",
  "not",
  "your",
  "my",
  "we",
  "they",
  "he",
  "she",
  "you",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "\u0645\u0646",
  "\u0641\u064A",
  "\u0639\u0644\u0649",
  "\u0625\u0644\u0649",
  "\u0639\u0646",
  "\u0623\u0646",
  "\u0625\u0646",
  "\u0647\u0630\u0627",
  "\u0647\u0630\u0647",
  "\u0645\u0639",
  "\u0623\u0648",
  "\u0648",
  "\u0644\u0627",
  "\u0645\u0627",
  "\u0647\u0648",
  "\u0647\u064A",
  "\u0627\u0644\u062A\u064A",
  "\u0627\u0644\u0630\u064A",
  "\u0643\u0644",
  "\u0628\u0639\u062F",
  "\u0642\u0628\u0644",
  "\u062D\u062A\u0649",
  "\u0643\u0627\u0646",
  "\u0643\u0627\u0646\u062A",
  "\u062A\u0645",
  "\u0644\u0642\u062F",
  "\u0628\u064A\u0646",
  "\u062D\u0648\u0644",
  "\u063A\u064A\u0631",
  "\u062B\u0645",
  "\u0623\u0648",
  "\u0628\u0644",
  "\u0644\u0643\u0646",
  "\u0639\u0646\u062F"
]);
function findAllSchemas(obj, schemasList = []) {
  if (!obj || typeof obj !== "object") return schemasList;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      findAllSchemas(item, schemasList);
    }
  } else {
    if (obj["@type"]) {
      schemasList.push({ type: String(obj["@type"]), data: obj });
    }
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "object") {
        findAllSchemas(obj[key], schemasList);
      }
    }
  }
  return schemasList;
}
function runSchemaCompletenessCheck(type, schemaData) {
  const checks = [];
  const lowerType = type.toLowerCase();
  const extractPriceAndCurrency = (obj) => {
    if (!obj || typeof obj !== "object") return { price: void 0, currency: void 0 };
    const checkOffer = (offer) => {
      if (!offer || typeof offer !== "object") return { price: void 0, currency: void 0 };
      if (offer.price !== void 0 && offer.price !== null && String(offer.price).trim().length > 0) {
        return { price: offer.price, currency: offer.priceCurrency };
      }
      if (offer.lowPrice !== void 0 && offer.lowPrice !== null && String(offer.lowPrice).trim().length > 0) {
        const priceVal = offer.highPrice ? `${offer.lowPrice} - ${offer.highPrice}` : String(offer.lowPrice);
        return { price: priceVal, currency: offer.priceCurrency };
      }
      if (offer.highPrice !== void 0 && offer.highPrice !== null && String(offer.highPrice).trim().length > 0) {
        return { price: offer.highPrice, currency: offer.priceCurrency };
      }
      if (offer.offers) {
        if (Array.isArray(offer.offers)) {
          for (const nested of offer.offers) {
            const res = checkOffer(nested);
            if (res.price) return res;
          }
        } else if (typeof offer.offers === "object") {
          const res = checkOffer(offer.offers);
          if (res.price) return res;
        }
      }
      return { price: void 0, currency: void 0 };
    };
    const offers = obj.offers;
    if (!offers) return { price: void 0, currency: void 0 };
    if (Array.isArray(offers)) {
      for (const offer of offers) {
        const res = checkOffer(offer);
        if (res.price) return res;
      }
    } else if (typeof offers === "object") {
      return checkOffer(offers);
    }
    return { price: void 0, currency: void 0 };
  };
  const extractRating = (obj) => {
    if (!obj || typeof obj !== "object") return void 0;
    const agg = obj.aggregateRating;
    if (agg && typeof agg === "object") {
      if (agg.ratingValue !== void 0 && agg.ratingValue !== null && String(agg.ratingValue).trim().length > 0) {
        return agg.ratingValue;
      }
    }
    const reviews = obj.review;
    if (reviews) {
      const reviewsArr = Array.isArray(reviews) ? reviews : [reviews];
      for (const rev of reviewsArr) {
        if (rev && rev.reviewRating && typeof rev.reviewRating === "object") {
          if (rev.reviewRating.ratingValue !== void 0 && rev.reviewRating.ratingValue !== null && String(rev.reviewRating.ratingValue).trim().length > 0) {
            return rev.reviewRating.ratingValue;
          }
        }
      }
    }
    if (obj.ratingValue !== void 0 && obj.ratingValue !== null && String(obj.ratingValue).trim().length > 0) {
      return obj.ratingValue;
    }
    return void 0;
  };
  const checkField = (fieldPath, label, importance, desc) => {
    let value;
    if (fieldPath.length === 2 && fieldPath[0] === "offers" && fieldPath[1] === "price") {
      value = extractPriceAndCurrency(schemaData).price;
    } else if (fieldPath.length === 2 && fieldPath[0] === "offers" && fieldPath[1] === "priceCurrency") {
      value = extractPriceAndCurrency(schemaData).currency;
    } else if (fieldPath.length === 2 && fieldPath[0] === "aggregateRating" && fieldPath[1] === "ratingValue") {
      value = extractRating(schemaData);
    } else {
      value = schemaData;
      for (const part of fieldPath) {
        if (value && typeof value === "object") {
          value = value[part];
        } else {
          value = void 0;
          break;
        }
      }
    }
    const exists = value !== void 0 && value !== null && String(value).trim().length > 0;
    let status = "good";
    if (!exists) {
      status = importance === "critical" ? "critical" : "warning";
    }
    let valueStr = "";
    if (exists) {
      if (typeof value === "object") {
        valueStr = value.name || value["@type"] || JSON.stringify(value);
      } else {
        valueStr = String(value);
      }
    }
    checks.push({
      field: label,
      exists,
      value: exists ? valueStr : void 0,
      status,
      description: desc
    });
  };
  if (lowerType.includes("article") || lowerType.includes("blogposting") || lowerType.includes("newsarticle")) {
    checkField(["headline"], "headline", "critical", "The main title of the article shown in search results.");
    checkField(["author"], "author", "critical", "Specifies the creator of the article (important for Google E-E-A-T).");
    checkField(["datePublished"], "datePublished", "critical", "The date the article was first made available online.");
    checkField(["description"], "description", "warning", "A brief summary of the article content.");
    checkField(["publisher"], "publisher", "warning", "The organization publishing the article.");
    checkField(["image"], "image", "warning", "A representative image URL for the article.");
  } else if (lowerType.includes("product")) {
    checkField(["name"], "name", "critical", "The brand-specific title of the product.");
    checkField(["offers", "price"], "price", "critical", "The cost of the product (needed for rich snippet badges).");
    checkField(["offers", "priceCurrency"], "priceCurrency", "critical", "Currency symbol or ISO code (e.g., USD, MAD).");
    checkField(["brand"], "brand", "warning", "The brand manufacturer of the product.");
    checkField(["description"], "description", "warning", "The main content or summary of the product description.");
    checkField(["aggregateRating", "ratingValue"], "ratingValue", "warning", "Average user rating score.");
    checkField(["image"], "image", "warning", "URLs of high-resolution product photos.");
  } else if (lowerType.includes("localbusiness") || lowerType.includes("restaurant") || lowerType.includes("store") || lowerType.includes("organization")) {
    checkField(["name"], "name", "critical", "The registered name of the business.");
    checkField(["address"], "address", "critical", "Physical mailing address of the establishment.");
    checkField(["telephone"], "telephone", "critical", "Public contact phone number.");
    checkField(["image"], "image", "warning", "An image or logo of the business.");
    checkField(["openingHours"], "openingHours", "warning", "Times of day when the business is open.");
    checkField(["geo"], "geo", "warning", "Latitude and longitude coordinates.");
  } else {
    checkField(["name"], "name", "critical", "Name or label of this entity.");
    checkField(["description"], "description", "warning", "Description of this entity.");
    checkField(["image"], "image", "warning", "Image representing this entity.");
  }
  return checks;
}
async function analyzeUrl(url, keyword, rawHtmlInput) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  try {
    let html = "";
    if (rawHtmlInput) {
      html = rawHtmlInput;
    } else {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D. \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 http:// \u0623\u0648 https://");
      }
      try {
        new URL(url);
      } catch (e) {
        throw new Error("\u0635\u064A\u063A\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0643\u062A\u0627\u0628\u0629 \u0631\u0627\u0628\u0637 \u0635\u062D\u064A\u062D \u0628\u062F\u0648\u0646 \u0645\u0633\u0627\u0641\u0627\u062A \u0623\u0648 \u0631\u0645\u0648\u0632 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629.");
      }
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ExtractorBot/1.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
        },
        signal: AbortSignal.timeout(12e3)
        // 12 second timeout
      });
      if (!response.ok) {
        throw new Error(`\u0641\u0634\u0644 \u062C\u0644\u0628 \u0627\u0644\u0635\u0641\u062D\u0629: ${response.status} ${response.statusText}`);
      }
      html = await response.text();
    }
    const $ = cheerio.load(html);
    let schemaAnalysis = null;
    const schemasFound = [];
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const rawText = $(element).text().trim();
        if (rawText) {
          const parsed = JSON.parse(rawText);
          findAllSchemas(parsed, schemasFound);
        }
      } catch (e) {
      }
    });
    if (schemasFound.length > 0) {
      let targetSchema = schemasFound.find((s) => {
        const t = s.type.toLowerCase();
        return t.includes("article") || t.includes("blogposting") || t.includes("newsarticle");
      });
      if (!targetSchema) {
        targetSchema = schemasFound.find((s) => s.type.toLowerCase().includes("product"));
      }
      if (!targetSchema) {
        targetSchema = schemasFound.find((s) => s.type.toLowerCase().includes("localbusiness") || s.type.toLowerCase().includes("restaurant") || s.type.toLowerCase().includes("store"));
      }
      if (!targetSchema) {
        targetSchema = schemasFound.find((s) => s.type.toLowerCase().includes("organization"));
      }
      if (!targetSchema) {
        targetSchema = schemasFound[0];
      }
      const type = targetSchema.type;
      const rawData = targetSchema.data;
      const completenessCheck = runSchemaCompletenessCheck(type, rawData);
      const missingFieldsCount = completenessCheck.filter((c) => c.status !== "good").length;
      const extractedData = {};
      completenessCheck.forEach((c) => {
        if (c.exists) {
          extractedData[c.field] = c.value;
        }
      });
      schemaAnalysis = {
        type,
        isValid: true,
        rawData,
        extractedData,
        completenessCheck,
        missingFieldsCount
      };
    }
    const bodyClone = $("body").clone();
    bodyClone.find("script, style, header, footer, nav, noscript, iframe, svg, head, aside, form, button, select, option").remove();
    bodyClone.find('[class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"], .ads, .ad, #ads, #ad, [class*="advertisement"], [id*="advertisement"], .social-share, .newsletter-signup').remove();
    const textContent = bodyClone.text();
    const cleanText = textContent.replace(/\s+/g, " ").trim();
    const wordsList = cleanText.split(/[\s,،.?!;:\-()"'’«»]+/u).filter((w) => w.length > 1);
    const wordCount = wordsList.length;
    let keywordAnalysis = null;
    if (keyword && keyword.trim().length > 0) {
      const kw = keyword.trim().toLowerCase();
      const escapedKw = escapeRegExp(kw);
      const regexWordBoundary = new RegExp(`\\b${escapedKw}\\b`, "gi");
      let count = (cleanText.match(regexWordBoundary) || []).length;
      if (count === 0 && cleanText.toLowerCase().includes(kw)) {
        const regexSub = new RegExp(escapedKw, "gi");
        count = (cleanText.match(regexSub) || []).length;
      }
      const density = wordCount > 0 ? count / wordCount * 100 : 0;
      let status = "good";
      let recommendation = "";
      if (density < 0.5) {
        status = "too-low";
        recommendation = `\u0646\u0633\u0628\u0629 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 (${density.toFixed(2)}%) \u0645\u0646\u062E\u0641\u0636\u0629 \u062C\u062F\u0627\u064B. \u0644\u0632\u064A\u0627\u062F\u0629 \u0627\u0644\u0638\u0647\u0648\u0631 \u0648\u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u0633\u064A\u0648\u060C \u062D\u0627\u0648\u0644 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 \u0628\u0634\u0643\u0644 \u0637\u0628\u064A\u0639\u064A \u0641\u064A \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0648\u0627\u0644\u0641\u0642\u0631\u0627\u062A \u0627\u0644\u0623\u0648\u0644\u0649.`;
      } else if (density > 2.5) {
        status = "stuffed";
        recommendation = `\u0646\u0633\u0628\u0629 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 (${density.toFixed(2)}%) \u0645\u0631\u062A\u0641\u0639\u0629 \u062C\u062F\u0627\u064B (\u062D\u0634\u0648 \u0627\u0644\u0643\u0644\u0645\u0627\u062A - Keyword Stuffing). \u0642\u062F \u064A\u0639\u0627\u0642\u0628 \u062C\u0648\u062C\u0644 \u0627\u0644\u0635\u0641\u062D\u0629 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0632\u0627\u0626\u062F. \u062D\u0627\u0648\u0644 \u062A\u0642\u0644\u064A\u0644 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0648\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0645\u0631\u0627\u062F\u0641\u0627\u062A \u0637\u0628\u064A\u0639\u064A\u0629.`;
      } else {
        status = "good";
        recommendation = `\u0645\u0645\u062A\u0627\u0632! \u0646\u0633\u0628\u0629 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 (${density.toFixed(2)}%) \u0645\u062B\u0627\u0644\u064A\u0629 \u062C\u062F\u0627\u064B \u0648\u062A\u0642\u0639 \u0641\u064A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0622\u0645\u0646 \u0627\u0644\u0637\u0628\u064A\u0639\u064A (0.5% - 2.5%).`;
      }
      keywordAnalysis = {
        keyword: keyword.trim(),
        count,
        density,
        status,
        recommendation
      };
    }
    const wordFrequencies = {};
    wordsList.forEach((rawWord) => {
      const word = rawWord.toLowerCase().replace(/[^a-zA-Z0-9أ-ي]/g, "");
      if (word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
        wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
      }
    });
    const topKeywords = Object.entries(wordFrequencies).map(([word, count]) => ({
      word,
      count,
      density: wordCount > 0 ? count / wordCount * 100 : 0
    })).sort((a, b) => b.count - a.count).slice(0, 10);
    const title = $("title").first().text().trim();
    const titleLength = title.length;
    const metaDescription = $('meta[name="description"]').first().attr("content")?.trim() || "";
    const metaDescriptionLength = metaDescription.length;
    const h1s = [];
    $("h1").each((_, el) => {
      const t = $(el).text().trim();
      if (t) h1s.push(t);
    });
    const h1Count = h1s.length;
    const h2s = [];
    $("h2").each((_, el) => {
      const t = $(el).text().trim();
      if (t) h2s.push(t);
    });
    const h2Count = h2s.length;
    let totalImages = 0;
    let imagesWithAlt = 0;
    $("img").each((_, el) => {
      totalImages++;
      const alt = $(el).attr("alt");
      if (alt && alt.trim().length > 0) {
        imagesWithAlt++;
      }
    });
    const imagesWithoutAlt = totalImages - imagesWithAlt;
    const altPercentage = totalImages > 0 ? imagesWithAlt / totalImages * 100 : 100;
    const checks = [];
    let score = 100;
    if (titleLength === 0) {
      score -= 20;
      checks.push({
        name: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 (Title Tag)",
        status: "danger",
        value: "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631",
        message: "\u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u0641\u062A\u0642\u0631 \u062A\u0645\u0627\u0645\u0627\u064B \u0625\u0644\u0649 \u0639\u0646\u0648\u0627\u0646 <title> \u0648\u0647\u0648 \u0627\u0644\u0645\u0639\u064A\u0627\u0631 \u0627\u0644\u0623\u0648\u0644 \u0644\u0644\u0623\u0631\u0634\u0641\u0629.",
        recommendation: "\u064A\u062C\u0628 \u0625\u0636\u0627\u0641\u0629 \u0648\u0633\u0645 <title> \u0641\u0648\u0631\u0627\u064B \u0648\u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0641\u064A \u0627\u0644\u0628\u062F\u0627\u064A\u0629."
      });
    } else if (titleLength < 40) {
      score -= 5;
      checks.push({
        name: "\u0637\u0648\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 (Title Length)",
        status: "warning",
        value: `${titleLength} \u062D\u0631\u0641`,
        message: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0635\u0641\u062D\u0629 \u0642\u0635\u064A\u0631 \u062C\u062F\u0627\u064B \u0648\u0642\u062F \u064A\u0641\u0648\u062A \u0641\u0631\u0635\u0629 \u062C\u0630\u0628 \u0646\u0642\u0631\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629.",
        recommendation: "\u0627\u062C\u0639\u0644 \u0637\u0648\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0628\u064A\u0646 45 \u0648 60 \u062D\u0631\u0641\u0627\u064B \u0644\u062C\u0639\u0644\u0647 \u062C\u0630\u0627\u0628\u0627\u064B \u0648\u0648\u0627\u0636\u062D\u0627\u064B \u0641\u064A \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0628\u062D\u062B."
      });
    } else if (titleLength > 65) {
      score -= 5;
      checks.push({
        name: "\u0637\u0648\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 (Title Length)",
        status: "warning",
        value: `${titleLength} \u062D\u0631\u0641`,
        message: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0637\u0648\u064A\u0644 \u062C\u062F\u0627\u064B \u0648\u0642\u062F \u064A\u062A\u0645 \u0642\u0637\u0639\u0647 \u0641\u064A \u0635\u0641\u062D\u0629 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0628\u062D\u062B \u0645\u0646 Google.",
        recommendation: "\u0627\u062E\u062A\u0635\u0631 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0644\u064A\u0643\u0648\u0646 \u0623\u0642\u0644 \u0645\u0646 60 \u0623\u0648 65 \u062D\u0631\u0641\u0627\u064B \u0644\u062A\u062C\u0646\u0628 \u0638\u0647\u0648\u0631 \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u062B\u0644\u0627\u062B (...)."
      });
    } else {
      checks.push({
        name: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 (Title Tag)",
        status: "good",
        value: `${titleLength} \u062D\u0631\u0641 (${title.substring(0, 30)}...)`,
        message: "\u0637\u0648\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0645\u062B\u0627\u0644\u064A \u0648\u0647\u064A\u0643\u0644 \u0627\u0644\u0648\u0633\u0645 \u0645\u0645\u062A\u0627\u0632.",
        recommendation: "\u0644\u0627 \u062D\u0627\u062C\u0629 \u0644\u0644\u062A\u063A\u064A\u064A\u0631. \u062D\u0627\u0641\u0638 \u0639\u0644\u0649 \u0627\u0644\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 \u0641\u064A \u0627\u0644\u0628\u062F\u0627\u064A\u0629."
      });
    }
    if (metaDescriptionLength === 0) {
      score -= 20;
      checks.push({
        name: "\u0627\u0644\u0648\u0635\u0641 (Meta Description)",
        status: "danger",
        value: "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631",
        message: "\u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u0641\u062A\u0642\u0631 \u0644\u0648\u0635\u0641 \u0627\u0644\u0645\u064A\u062A\u0627\u060C \u0645\u0645\u0627 \u064A\u062C\u0639\u0644 \u0645\u062D\u0631\u0643\u0627\u062A \u0627\u0644\u0628\u062D\u062B \u062A\u0633\u062A\u0642\u0637\u0639 \u062C\u0645\u0644\u0627\u064B \u0639\u0634\u0648\u0627\u0626\u064A\u0629 \u0645\u0646 \u0627\u0644\u0635\u0641\u062D\u0629.",
        recommendation: '\u0623\u0636\u0641 \u0648\u0633\u0645\u0627\u064B \u0628\u0640 <meta name="description"> \u064A\u0644\u062E\u0635 \u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0641\u062D\u0629 \u0644\u062C\u0630\u0628 \u0627\u0644\u0632\u0648\u0627\u0631.'
      });
    } else if (metaDescriptionLength < 100) {
      score -= 5;
      checks.push({
        name: "\u0637\u0648\u0644 \u0627\u0644\u0648\u0635\u0641 (Description Length)",
        status: "warning",
        value: `${metaDescriptionLength} \u062D\u0631\u0641`,
        message: "\u0627\u0644\u0648\u0635\u0641 \u0642\u0635\u064A\u0631 \u062C\u062F\u0627\u064B \u0648\u0642\u062F \u0644\u0627 \u064A\u0648\u0641\u0631 \u0633\u064A\u0627\u0642\u0627\u064B \u0643\u0627\u0641\u064A\u0627\u064B \u0644\u0644\u0628\u0627\u062D\u062B\u064A\u0646.",
        recommendation: "\u0642\u0645 \u0628\u0632\u064A\u0627\u062F\u0629 \u0627\u0644\u0648\u0635\u0641 \u0644\u064A\u0635\u0628\u062D \u0628\u064A\u0646 120 \u0648 160 \u062D\u0631\u0641\u0627\u064B \u0644\u0625\u0639\u0637\u0627\u0621 \u062A\u0641\u0627\u0635\u064A\u0644 \u0643\u0627\u0641\u064A\u0629 \u0648\u0645\u0642\u0646\u0639\u0629 \u0644\u0644\u0646\u0642\u0631."
      });
    } else if (metaDescriptionLength > 165) {
      score -= 5;
      checks.push({
        name: "\u0637\u0648\u0644 \u0627\u0644\u0648\u0635\u0641 (Description Length)",
        status: "warning",
        value: `${metaDescriptionLength} \u062D\u0631\u0641`,
        message: "\u0627\u0644\u0648\u0635\u0641 \u0637\u0648\u064A\u0644 \u062C\u062F\u0627\u064B \u0648\u0633\u064A\u0638\u0647\u0631 \u0645\u0642\u0637\u0648\u0639\u0627\u064B \u0641\u064A \u0646\u062A\u0627\u0626\u062C \u0628\u062D\u062B \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0630\u0643\u064A\u0629 \u0648\u0627\u0644\u062D\u0648\u0627\u0633\u064A\u0628.",
        recommendation: "\u0642\u0645 \u0628\u062A\u0644\u062E\u064A\u0635 \u0627\u0644\u0648\u0635\u0641 \u0644\u064A\u0643\u0648\u0646 \u0628\u064A\u0646 120 \u0648 155 \u062D\u0631\u0641\u0627\u064B \u0644\u0644\u0638\u0647\u0648\u0631 \u0628\u0634\u0643\u0644 \u0643\u0627\u0645\u0644."
      });
    } else {
      checks.push({
        name: "\u0627\u0644\u0648\u0635\u0641 (Meta Description)",
        status: "good",
        value: `${metaDescriptionLength} \u062D\u0631\u0641`,
        message: "\u0637\u0648\u0644 \u0627\u0644\u0648\u0635\u0641 \u0645\u062B\u0627\u0644\u064A \u0648\u0633\u064A\u0646\u0639\u0643\u0633 \u0628\u0634\u0643\u0644 \u0631\u0627\u0626\u0639 \u0641\u064A \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0628\u062D\u062B.",
        recommendation: "\u0644\u0627 \u062D\u0627\u062C\u0629 \u0644\u0644\u062A\u063A\u064A\u064A\u0631. \u062A\u0623\u0643\u062F \u0641\u0642\u0637 \u0623\u0646\u0647 \u064A\u062F\u0641\u0639 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0644\u0646\u0642\u0631 (Call to action)."
      });
    }
    if (h1Count === 0) {
      score -= 15;
      checks.push({
        name: "\u0648\u0633\u0648\u0645 \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 H1",
        status: "danger",
        value: "0 \u0648\u0633\u0648\u0645",
        message: "\u0627\u0644\u0635\u0641\u062D\u0629 \u0644\u0627 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0623\u064A \u0639\u0646\u0648\u0627\u0646 H1. \u0647\u0630\u0627 \u064A\u0635\u0639\u0628 \u0641\u0647\u0645 \u0641\u0643\u0631\u0629 \u0627\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629 \u0644\u062F\u0649 \u0627\u0644\u0631\u0648\u0628\u0648\u062A\u0627\u062A.",
        recommendation: "\u064A\u062C\u0628 \u0625\u062F\u0631\u0627\u062C \u0639\u0646\u0648\u0627\u0646 H1 \u0648\u062D\u064A\u062F \u0648\u0645\u0645\u064A\u0632 \u0641\u064A \u0623\u0639\u0644\u0649 \u0627\u0644\u0635\u0641\u062D\u0629 \u064A\u0645\u062B\u0644 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0644\u0644\u0645\u0642\u0627\u0644 \u0623\u0648 \u0627\u0644\u0645\u0646\u062A\u062C."
      });
    } else if (h1Count > 1) {
      score -= 8;
      checks.push({
        name: "\u0648\u0633\u0648\u0645 \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 H1",
        status: "warning",
        value: `${h1Count} \u0648\u0633\u0648\u0645`,
        message: "\u062A\u062D\u062A\u0648\u064A \u0627\u0644\u0635\u0641\u062D\u0629 \u0639\u0644\u0649 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0648\u0633\u0645 H1 \u0648\u0627\u062D\u062F. \u0647\u0630\u0627 \u0642\u062F \u064A\u0634\u062A\u062A \u062A\u0631\u0643\u064A\u0632 \u062E\u0648\u0627\u0631\u0632\u0645\u064A\u0627\u062A \u0627\u0644\u0633\u064A\u0648 \u062D\u0648\u0644 \u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0623\u0633\u0627\u0633\u064A.",
        recommendation: "\u064A\u064F\u0641\u0636\u0644 \u062A\u0642\u0644\u064A\u0635 \u0648\u0633\u0648\u0645 H1 \u0644\u064A\u0643\u0648\u0646 \u0648\u0633\u0645\u0627\u064B \u0648\u0627\u062D\u062F\u0627\u064B \u0641\u0642\u0637 \u0644\u0644\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u060C \u0648\u0627\u0633\u062A\u062E\u062F\u0627\u0645 H2 \u0623\u0648 H3 \u0644\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0641\u0631\u0639\u064A\u0629."
      });
    } else {
      checks.push({
        name: "\u0648\u0633\u0648\u0645 \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 H1",
        status: "good",
        value: "\u0648\u0633\u0645 \u0648\u0627\u062D\u062F H1",
        message: "\u0645\u062B\u0627\u0644\u064A! \u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u0636\u0645 \u0648\u0633\u0645\u0627\u064B \u0631\u0626\u064A\u0633\u064A\u0627\u064B \u0648\u0627\u062D\u062F\u0627\u064B H1 \u0643\u0645\u0627 \u062A\u0645\u0644\u064A\u0647 \u0645\u0639\u0627\u064A\u064A\u0631 \u0627\u0644\u0633\u064A\u0648 \u0627\u0644\u062D\u062F\u064A\u062B\u0629.",
        recommendation: "\u0645\u0645\u062A\u0627\u0632. \u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u062D\u062A\u0648\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0641\u0631\u064A\u062F \u0639\u0644\u0649 \u0643\u0644\u0645\u062A\u0643 \u0627\u0644\u0645\u0641\u062A\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629."
      });
    }
    if (h2Count === 0) {
      score -= 5;
      checks.push({
        name: "\u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0641\u0631\u0639\u064A\u0629 H2",
        status: "warning",
        value: "0 \u0648\u0633\u0648\u0645",
        message: "\u0627\u0644\u0635\u0641\u062D\u0629 \u0644\u0627 \u062A\u0636\u0645 \u0623\u064A \u0639\u0646\u0648\u0627\u0646 \u0641\u0631\u0639\u064A H2 \u0644\u062A\u0646\u0638\u064A\u0645 \u0628\u0646\u064A\u0629 \u0627\u0644\u0646\u0635.",
        recommendation: "\u0642\u0645 \u0628\u0625\u0636\u0627\u0641\u0629 \u0639\u0646\u0627\u0648\u064A\u0646 \u0641\u0631\u0639\u064A\u0629 H2 \u0644\u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0646\u0635 \u0644\u0641\u0642\u0631\u0627\u062A \u064A\u0633\u0647\u0644 \u0639\u0644\u0649 \u0627\u0644\u0642\u0627\u0631\u0626 \u0648\u0645\u062D\u0631\u0643\u0627\u062A \u0627\u0644\u0628\u062D\u062B \u062A\u0635\u0641\u062D\u0647\u0627."
      });
    } else {
      checks.push({
        name: "\u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0641\u0631\u0639\u064A\u0629 H2",
        status: "good",
        value: `${h2Count} \u0648\u0633\u0648\u0645 H2`,
        message: "\u0647\u064A\u0643\u0644 \u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0635\u0641\u062D\u0629 \u062C\u064A\u062F \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0641\u0631\u0639\u064A\u0629.",
        recommendation: "\u0645\u0645\u062A\u0627\u0632. \u062A\u0646\u0638\u064A\u0645 \u0628\u0646\u064A\u0629 \u0627\u0644\u0646\u0635 \u064A\u0633\u0627\u0639\u062F \u0639\u0644\u0649 \u062A\u062D\u0633\u064A\u0646 \u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0648\u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0627\u0644\u0632\u0627\u0626\u0631."
      });
    }
    if (totalImages > 0) {
      if (altPercentage === 100) {
        checks.push({
          name: "\u0646\u0635\u0648\u0635 \u0635\u0648\u0631 \u0628\u062F\u064A\u0644\u0629 ALT",
          status: "good",
          value: "100% \u0645\u063A\u0637\u0627\u0629",
          message: `\u062C\u0645\u064A\u0639 \u0627\u0644\u0635\u0648\u0631 \u0628\u0627\u0644\u0635\u0641\u062D\u0629 (${totalImages} \u0635\u0648\u0631) \u062A\u0645\u062A\u0644\u0643 \u0648\u0633\u0648\u0645 ALT \u0648\u0635\u0641\u064A\u0629.`,
          recommendation: "\u0631\u0627\u0626\u0639! \u0647\u0630\u0627 \u064A\u0636\u0645\u0646 \u0641\u0647\u0631\u0633\u0629 \u0627\u0644\u0635\u0648\u0631 \u0641\u064A \u0642\u0633\u0645 \u0628\u062D\u062B \u0627\u0644\u0635\u0648\u0631 \u0628\u0640 Google \u0648\u064A\u0633\u0647\u0644 \u0625\u0645\u0643\u0627\u0646\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644."
        });
      } else if (altPercentage < 50) {
        score -= 10;
        checks.push({
          name: "\u0646\u0635\u0648\u0635 \u0635\u0648\u0631 \u0628\u062F\u064A\u0644\u0629 ALT",
          status: "danger",
          value: `${altPercentage.toFixed(0)}% \u0645\u063A\u0637\u0627\u0629`,
          message: `\u0647\u0646\u0627\u0644\u0643 ${imagesWithoutAlt} \u0635\u0648\u0631 \u0645\u0646 \u0623\u0635\u0644 ${totalImages} \u0644\u0627 \u062A\u0645\u062A\u0644\u0643 \u0648\u0633\u0648\u0645 ALT \u062A\u0648\u0636\u064A\u062D\u064A\u0629.`,
          recommendation: "\u0642\u0645 \u0628\u0625\u0636\u0627\u0641\u0629 \u0646\u0635\u0648\u0635 \u0628\u062F\u064A\u0644\u0629 ALT \u062F\u0642\u064A\u0642\u0629 \u0648\u0648\u0627\u0636\u062D\u0629 \u062A\u0635\u0641 \u0645\u062D\u062A\u0648\u0649 \u0643\u0644 \u0635\u0648\u0631\u0629 \u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0631\u0648\u0628\u0648\u062A\u0627\u062A \u062C\u0648\u062C\u0644."
        });
      } else {
        score -= 5;
        checks.push({
          name: "\u0646\u0635\u0648\u0635 \u0635\u0648\u0631 \u0628\u062F\u064A\u0644\u0629 ALT",
          status: "warning",
          value: `${altPercentage.toFixed(0)}% \u0645\u063A\u0637\u0627\u0629`,
          message: `\u062A\u0641\u062A\u0642\u0631 ${imagesWithoutAlt} \u0635\u0648\u0631\u0629 \u0644\u0648\u0635\u0641 ALT \u0627\u0644\u0628\u062F\u064A\u0644.`,
          recommendation: "\u064A\u064F\u0633\u062A\u062D\u0633\u0646 \u062A\u0632\u0648\u064A\u062F \u0628\u0642\u064A\u0629 \u0627\u0644\u0635\u0648\u0631 \u0628\u0648\u0635\u0641 ALT \u0644\u062A\u062C\u0639\u0644 \u0627\u0644\u0635\u0641\u062D\u0629 \u0645\u062B\u0627\u0644\u064A\u0629 \u0644\u0644\u0648\u0635\u0648\u0644 \u0648\u0627\u0644\u0623\u0631\u0634\u0641\u0629."
        });
      }
    } else {
      checks.push({
        name: "\u0627\u0644\u0635\u0648\u0631 \u0628\u0627\u0644\u0635\u0641\u062D\u0629",
        status: "good",
        value: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631",
        message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631 \u0628\u0627\u0644\u0635\u0641\u062D\u0629 \u0644\u062A\u0642\u064A\u064A\u0645 \u0646\u0635\u0648\u0635\u0647\u0627 \u0627\u0644\u0628\u062F\u064A\u0644\u0629.",
        recommendation: "\u0641\u0643\u0631 \u0641\u064A \u0625\u0636\u0627\u0641\u0629 \u0635\u0648\u0631 \u062A\u0648\u0636\u064A\u062D\u064A\u0629 \u063A\u0646\u064A\u0629 \u0628\u0627\u0644\u0646\u0635\u0648\u0635 \u0627\u0644\u0628\u062F\u064A\u0644\u0629 ALT \u0644\u0632\u064A\u0627\u062F\u0629 \u062A\u0641\u0627\u0639\u0644 \u0627\u0644\u0632\u0648\u0627\u0631 \u0645\u0639 \u0627\u0644\u0645\u062D\u062A\u0648\u0649."
      });
    }
    if (!schemaAnalysis) {
      score -= 10;
      checks.push({
        name: "\u0628\u064A\u0627\u0646\u0627\u062A Schema \u0627\u0644\u0647\u064A\u0643\u0644\u064A\u0629",
        status: "danger",
        value: "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629",
        message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0623\u064A \u0643\u0648\u062F Schema JSON-LD \u0628\u0627\u0644\u0635\u0641\u062D\u0629. \u0647\u0630\u0627 \u064A\u062D\u0631\u0645\u0643 \u0645\u0646 \u0638\u0647\u0648\u0631 \u063A\u0646\u064A (Rich Snippets).",
        recommendation: "\u0623\u0636\u0641 \u0643\u0648\u062F Schema JSON-LD \u0645\u0646\u0627\u0633\u0628 \u0644\u0646\u0648\u0639 \u0635\u0641\u062D\u062A\u0643 (\u0645\u0642\u0627\u0644\u060C \u0645\u0646\u062A\u062C\u060C \u0623\u0648 \u0646\u0634\u0627\u0637 \u0645\u062D\u0644\u064A) \u0641\u064A \u0623\u0633\u0631\u0639 \u0648\u0642\u062A."
      });
    } else {
      checks.push({
        name: "\u0628\u064A\u0627\u0646\u0627\u062A Schema \u0627\u0644\u0647\u064A\u0643\u0644\u064A\u0629",
        status: "good",
        value: `${schemaAnalysis.type}`,
        message: `\u062A\u0645 \u0631\u0635\u062F \u0643\u0648\u062F Schema \u0645\u0646 \u0646\u0648\u0639 ${schemaAnalysis.type} \u0628\u0646\u062C\u0627\u062D.`,
        recommendation: `\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0643\u062A\u0645\u0627\u0644 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0642\u0648\u0644 \u0641\u064A \u0642\u0633\u0645 \u0627\u0644\u0633\u0643\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0635\u0635 \u0644\u0636\u0645\u0627\u0646 \u062A\u0641\u0639\u064A\u0644 \u0645\u064A\u0632\u0627\u062A \u0645\u062D\u0631\u0643 \u0627\u0644\u0628\u062D\u062B \u0628\u0627\u0644\u0643\u0627\u0645\u0644.`
      });
    }
    score = Math.max(10, Math.min(100, score));
    const seoAudit = {
      title,
      titleLength,
      metaDescription,
      metaDescriptionLength,
      h1Count,
      h1s,
      h2Count,
      h2s,
      totalImages,
      imagesWithAlt,
      imagesWithoutAlt,
      altPercentage,
      score,
      checks
    };
    const readability = calculateReadability(cleanText);
    return {
      url: rawHtmlInput ? "\u0645\u062D\u062A\u0648\u0649 \u0646\u0635\u064A \u0645\u062F\u062E\u0644 \u064A\u062F\u0648\u064A\u0627\u064B" : url,
      success: true,
      wordCount,
      extractedText: cleanText.substring(0, 1e3),
      // Return sample of clean extracted text
      schema: schemaAnalysis,
      keywordAnalysis,
      topKeywords,
      seoAudit,
      readability,
      timestamp
    };
  } catch (error) {
    return {
      url,
      success: false,
      error: error.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629",
      wordCount: 0,
      extractedText: "",
      schema: null,
      keywordAnalysis: null,
      topKeywords: [],
      seoAudit: {
        title: "",
        titleLength: 0,
        metaDescription: "",
        metaDescriptionLength: 0,
        h1Count: 0,
        h1s: [],
        h2Count: 0,
        h2s: [],
        totalImages: 0,
        imagesWithAlt: 0,
        imagesWithoutAlt: 0,
        altPercentage: 0,
        score: 0,
        checks: []
      },
      readability: void 0,
      timestamp
    };
  }
}
function countSyllablesInWord(word) {
  const arabicRegex = /[\u0600-\u06FF]/;
  if (arabicRegex.test(word)) {
    const longVowels = (word.match(/[اوىي]/g) || []).length;
    return Math.max(1, Math.min(word.length, Math.round((word.length + longVowels) / 2)));
  }
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}
function calculateReadability(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) {
    return {
      readingEase: 0,
      gradeLevel: 0,
      easeLabel: "\u0645\u062D\u062A\u0648\u0649 \u0641\u0627\u0631\u063A",
      easeDescription: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u062D\u062A\u0648\u0649 \u0646\u0635\u064A \u0643\u0627\u0641\u064D \u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0642\u0631\u0648\u0626\u064A\u0629.",
      gradeLabel: "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F",
      sentencesCount: 0,
      wordsCount: 0,
      syllablesCount: 0
    };
  }
  const sentences = clean.split(/[.!?؟]+|\n+/).filter((s) => s.trim().length > 2);
  const sentenceCount = Math.max(1, sentences.length);
  const words = clean.split(/[\s,،.?!;:\-()"'’«»]+/u).filter((w) => w.length > 0);
  const wordCount = Math.max(1, words.length);
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllablesInWord(word);
  }
  const asl = wordCount / sentenceCount;
  const asw = totalSyllables / wordCount;
  let readingEase = 206.835 - 1.015 * asl - 84.6 * asw;
  readingEase = Math.max(0, Math.min(100, readingEase));
  let gradeLevel = 0.39 * asl + 11.8 * asw - 15.59;
  gradeLevel = Math.max(1, Math.min(18, gradeLevel));
  let easeLabel = "";
  let easeDescription = "";
  if (readingEase >= 90) {
    easeLabel = "\u0633\u0647\u0644 \u062C\u062F\u0627\u064B";
    easeDescription = "\u0645\u062D\u062A\u0648\u0649 \u0633\u0647\u0644 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0644\u0644\u063A\u0627\u064A\u0629\u060C \u0648\u0645\u0646\u0627\u0633\u0628 \u0644\u0623\u0639\u0645\u0627\u0631 10 \u0633\u0646\u0648\u0627\u062A \u0641\u0645\u0627 \u0641\u0648\u0642 (\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A).";
  } else if (readingEase >= 80) {
    easeLabel = "\u0633\u0647\u0644";
    easeDescription = "\u0633\u0647\u0644 \u0627\u0644\u0642\u0631\u0627\u0621\u0629\u060C \u0648\u0645\u0646\u0627\u0633\u0628 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A. \u064A\u0633\u0647\u0644 \u0641\u0647\u0645\u0647 \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0639\u0638\u0645 \u0627\u0644\u0642\u0631\u0627\u0621 \u0627\u0644\u0639\u0627\u062F\u064A\u064A\u0646.";
  } else if (readingEase >= 70) {
    easeLabel = "\u0633\u0647\u0644 \u0646\u0633\u0628\u064A\u0627\u064B";
    easeDescription = "\u0644\u063A\u0629 \u0648\u0627\u0636\u062D\u0629 \u0648\u0628\u0633\u064A\u0637\u0629\u060C \u0645\u0646\u0627\u0633\u0628 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u0628\u0639 (\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A\u0629).";
  } else if (readingEase >= 60) {
    easeLabel = "\u0642\u064A\u0627\u0633\u064A / \u0645\u062A\u0648\u0633\u0637";
    easeDescription = "\u0644\u063A\u0629 \u064A\u0648\u0645\u064A\u0629 \u0642\u064A\u0627\u0633\u064A\u0629\u060C \u0645\u0646\u0627\u0633\u0628 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0635\u0641\u064A\u0646 \u0627\u0644\u062B\u0627\u0645\u0646 \u0648\u0627\u0644\u062A\u0627\u0633\u0639 (\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A\u0629).";
  } else if (readingEase >= 50) {
    easeLabel = "\u0635\u0639\u0628 \u0646\u0633\u0628\u064A\u0627\u064B";
    easeDescription = "\u0645\u0646\u0627\u0633\u0628 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062B\u0627\u0646\u0648\u064A\u0629 (\u0627\u0644\u0635\u0641\u0648\u0641 10 \u0625\u0644\u0649 12). \u064A\u062A\u0637\u0644\u0628 \u062A\u0631\u0643\u064A\u0632\u0627\u064B \u0645\u062A\u0648\u0633\u0637\u0627\u064B \u0648\u0642\u062F\u0631\u0629 \u0642\u0631\u0627\u0626\u064A\u0629 \u062C\u064A\u062F\u0629.";
  } else if (readingEase >= 30) {
    easeLabel = "\u0635\u0639\u0628 / \u0623\u0643\u0627\u062F\u064A\u0645\u064A";
    easeDescription = "\u0645\u0646\u0627\u0633\u0628 \u0644\u0637\u0644\u0627\u0628 \u0627\u0644\u062C\u0627\u0645\u0639\u0627\u062A \u0648\u0627\u0644\u062E\u0631\u064A\u062C\u064A\u0646. \u064A\u062A\u0636\u0645\u0646 \u0645\u0641\u0631\u062F\u0627\u062A \u062A\u0642\u0646\u064A\u0629 \u0623\u0648 \u0628\u0646\u064A\u0629 \u062C\u0645\u0644 \u0645\u0639\u0642\u062F\u0629 \u0648\u0637\u0648\u064A\u0644\u0629.";
  } else {
    easeLabel = "\u0635\u0639\u0628 \u062C\u062F\u0627\u064B / \u0645\u0639\u0642\u062F";
    easeDescription = "\u0645\u062D\u062A\u0648\u0649 \u0645\u0639\u0642\u062F \u062C\u062F\u0627\u064B\u060C \u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u0645\u062A\u062E\u0635\u0635\u064A\u0646 \u0648\u0627\u0644\u0623\u0643\u0627\u062F\u064A\u0645\u064A\u064A\u0646 \u0648\u062E\u0631\u064A\u062C\u064A \u0627\u0644\u062F\u0631\u0627\u0633\u0627\u062A \u0627\u0644\u0639\u0644\u064A\u0627 \u0641\u0642\u0637.";
  }
  let gradeLabel = "";
  const roundedGrade = Math.round(gradeLevel);
  if (roundedGrade <= 5) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062E\u0627\u0645\u0633 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A \u0623\u0648 \u0623\u0642\u0644";
  } else if (roundedGrade === 6) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u062F\u0633 \u0627\u0644\u0627\u0628\u062A\u062F\u0627\u0626\u064A";
  } else if (roundedGrade === 7) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0633\u0627\u0628\u0639 (\u0623\u0648\u0644 \u0625\u0639\u062F\u0627\u062F\u064A)";
  } else if (roundedGrade === 8) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0645\u0646 (\u062B\u0627\u0646\u064A \u0625\u0639\u062F\u0627\u062F\u064A)";
  } else if (roundedGrade === 9) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062A\u0627\u0633\u0639 (\u062B\u0627\u0644\u062B \u0625\u0639\u062F\u0627\u062F\u064A)";
  } else if (roundedGrade === 10) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0639\u0627\u0634\u0631 (\u0623\u0648\u0644 \u062B\u0627\u0646\u0648\u064A)";
  } else if (roundedGrade === 11) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062D\u0627\u062F\u064A \u0639\u0634\u0631 (\u062B\u0627\u0646\u064A \u062B\u0627\u0646\u0648\u064A)";
  } else if (roundedGrade === 12) {
    gradeLabel = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0639\u0634\u0631 (\u062B\u0627\u0644\u062B \u062B\u0627\u0646\u0648\u064A)";
  } else if (roundedGrade <= 16) {
    gradeLabel = "\u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u062C\u0627\u0645\u0639\u064A\u0629 (\u0628\u0643\u0627\u0644\u0648\u0631\u064A\u0648\u0633)";
  } else {
    gradeLabel = "\u0627\u0644\u062F\u0631\u0627\u0633\u0627\u062A \u0627\u0644\u0639\u0644\u064A\u0627 \u0648\u0627\u0644\u0628\u062D\u062B \u0627\u0644\u0639\u0644\u0645\u064A";
  }
  return {
    readingEase: parseFloat(readingEase.toFixed(1)),
    gradeLevel: parseFloat(gradeLevel.toFixed(1)),
    easeLabel,
    easeDescription,
    gradeLabel,
    sentencesCount: sentenceCount,
    wordsCount: wordCount,
    syllablesCount: totalSyllables
  };
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "10mb" }));
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/proxy-fetch", async (req, res) => {
    try {
      const target = req.query.url;
      if (!target || typeof target !== "string") {
        return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u062A\u0632\u0648\u064A\u062F \u0631\u0627\u0628\u0637 \u0635\u0627\u0644\u062D \u0644\u0644\u0645\u0639\u0627\u0644\u062C\u0629." });
      }
      try {
        new URL(target);
      } catch (e) {
        return res.status(400).json({ error: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0623\u0643\u062F \u0645\u0646 \u0643\u062A\u0627\u0628\u0629 \u0631\u0627\u0628\u0637 \u0635\u062D\u064A\u062D \u0628\u062F\u0648\u0646 \u0645\u0633\u0627\u0641\u0627\u062A \u0623\u0648 \u0631\u0645\u0648\u0632 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." });
      }
      const response = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ExtractorBot/1.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
        },
        signal: AbortSignal.timeout(12e3)
        // 12 second timeout
      });
      if (!response.ok) {
        throw new Error(`\u0641\u0634\u0644 \u062C\u0644\u0628 \u0627\u0644\u0635\u0641\u062D\u0629: ${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      return res.json({ contents: html });
    } catch (err) {
      console.error("Proxy fetch error:", err);
      return res.status(500).json({
        error: err.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u062B\u0646\u0627\u0621 \u062C\u0644\u0628 \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u062E\u0627\u0631\u062C\u064A."
      });
    }
  });
  app.post("/api/analyze", async (req, res) => {
    try {
      const { url, keyword, rawHtml } = req.body;
      if (!rawHtml && (!url || typeof url !== "string")) {
        return res.status(400).json({
          success: false,
          error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0631\u0627\u0628\u0637 \u0635\u0627\u0644\u062D \u0623\u0648 \u0643\u062A\u0627\u0628\u0629 \u0643\u0648\u062F HTML \u064A\u062F\u0648\u064A\u0627\u064B."
        });
      }
      const report = await analyzeUrl(url || "", keyword, rawHtml);
      return res.json(report);
    } catch (err) {
      console.error("Analysis error:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u062B\u0646\u0627\u0621 \u0645\u0639\u0627\u0644\u062C\u0629 \u0637\u0644\u0628\u0643."
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("[Dev Server] Vite middleware integrated.");
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
    console.log("[Prod Server] Serving static dist files.");
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Web application listening on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((error) => {
  console.error("[Startup Error] Failed to boot full-stack server:", error);
});
//# sourceMappingURL=server.cjs.map
