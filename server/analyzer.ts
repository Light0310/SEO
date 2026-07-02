import * as cheerio from 'cheerio';
import { 
  AnalysisReport, 
  SchemaAnalysis, 
  SchemaFieldCheck, 
  SeoAudit, 
  SeoCheckItem, 
  KeywordResult, 
  TopKeyword 
} from '../src/types';

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Common stop words (English and Arabic)
const STOP_WORDS = new Set([
  'the', 'and', 'a', 'to', 'of', 'in', 'is', 'that', 'it', 'on', 'for', 'as', 'with', 'was', 'at', 'by', 'an', 'be', 'this', 'are', 'or', 'from', 'but', 'not', 'your', 'my', 'we', 'they', 'he', 'she', 'you', 'have', 'has', 'had', 'do', 'does', 'did',
  'من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'هذا', 'هذه', 'مع', 'أو', 'و', 'لا', 'ما', 'هو', 'هي', 'التي', 'الذي', 'كل', 'بعد', 'قبل', 'حتى', 'كان', 'كانت', 'تم', 'لقد', 'بين', 'حول', 'غير', 'ثم', 'أو', 'بل', 'لكن', 'عند'
]);

/**
 * Find schema JSON-LD objects recursively in parsed JSON objects
 */
function findSchemaByType(obj: any, targetTypes: string[]): any {
  if (!obj || typeof obj !== 'object') return null;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findSchemaByType(item, targetTypes);
      if (found) return found;
    }
  }
  
  if (obj['@type']) {
    const type = String(obj['@type']);
    if (targetTypes.some(t => type.toLowerCase() === t.toLowerCase() || type.toLowerCase().endsWith('.' + t.toLowerCase()))) {
      return obj;
    }
  }
  
  // Also check nested objects
  for (const key of Object.keys(obj)) {
    const found = findSchemaByType(obj[key], targetTypes);
    if (found) return found;
  }
  
  return null;
}

/**
 * Scan all schemas in parsed json to list what we found
 */
function findAllSchemas(obj: any, schemasList: { type: string; data: any }[] = []): any[] {
  if (!obj || typeof obj !== 'object') return schemasList;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      findAllSchemas(item, schemasList);
    }
  } else {
    if (obj['@type']) {
      schemasList.push({ type: String(obj['@type']), data: obj });
    }
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        findAllSchemas(obj[key], schemasList);
      }
    }
  }
  return schemasList;
}

/**
 * Run completeness check on structured schema data based on its type
 */
function runSchemaCompletenessCheck(type: string, schemaData: any): SchemaFieldCheck[] {
  const checks: SchemaFieldCheck[] = [];
  const lowerType = type.toLowerCase();
  
  const extractPriceAndCurrency = (obj: any): { price: any; currency: any } => {
    if (!obj || typeof obj !== 'object') return { price: undefined, currency: undefined };

    const checkOffer = (offer: any): { price: any; currency: any } => {
      if (!offer || typeof offer !== 'object') return { price: undefined, currency: undefined };

      if (offer.price !== undefined && offer.price !== null && String(offer.price).trim().length > 0) {
        return { price: offer.price, currency: offer.priceCurrency };
      }

      if (offer.lowPrice !== undefined && offer.lowPrice !== null && String(offer.lowPrice).trim().length > 0) {
        const priceVal = offer.highPrice ? `${offer.lowPrice} - ${offer.highPrice}` : String(offer.lowPrice);
        return { price: priceVal, currency: offer.priceCurrency };
      }
      if (offer.highPrice !== undefined && offer.highPrice !== null && String(offer.highPrice).trim().length > 0) {
        return { price: offer.highPrice, currency: offer.priceCurrency };
      }

      if (offer.offers) {
        if (Array.isArray(offer.offers)) {
          for (const nested of offer.offers) {
            const res = checkOffer(nested);
            if (res.price) return res;
          }
        } else if (typeof offer.offers === 'object') {
          const res = checkOffer(offer.offers);
          if (res.price) return res;
        }
      }

      return { price: undefined, currency: undefined };
    };

    const offers = obj.offers;
    if (!offers) return { price: undefined, currency: undefined };

    if (Array.isArray(offers)) {
      for (const offer of offers) {
        const res = checkOffer(offer);
        if (res.price) return res;
      }
    } else if (typeof offers === 'object') {
      return checkOffer(offers);
    }

    return { price: undefined, currency: undefined };
  };

  const extractRating = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return undefined;

    const agg = obj.aggregateRating;
    if (agg && typeof agg === 'object') {
      if (agg.ratingValue !== undefined && agg.ratingValue !== null && String(agg.ratingValue).trim().length > 0) {
        return agg.ratingValue;
      }
    }

    const reviews = obj.review;
    if (reviews) {
      const reviewsArr = Array.isArray(reviews) ? reviews : [reviews];
      for (const rev of reviewsArr) {
        if (rev && rev.reviewRating && typeof rev.reviewRating === 'object') {
          if (rev.reviewRating.ratingValue !== undefined && rev.reviewRating.ratingValue !== null && String(rev.reviewRating.ratingValue).trim().length > 0) {
            return rev.reviewRating.ratingValue;
          }
        }
      }
    }

    if (obj.ratingValue !== undefined && obj.ratingValue !== null && String(obj.ratingValue).trim().length > 0) {
      return obj.ratingValue;
    }

    return undefined;
  };

  const checkField = (
    fieldPath: string[], 
    label: string, 
    importance: 'critical' | 'warning', 
    desc: string
  ) => {
    let value: any;
    if (fieldPath.length === 2 && fieldPath[0] === 'offers' && fieldPath[1] === 'price') {
      value = extractPriceAndCurrency(schemaData).price;
    } else if (fieldPath.length === 2 && fieldPath[0] === 'offers' && fieldPath[1] === 'priceCurrency') {
      value = extractPriceAndCurrency(schemaData).currency;
    } else if (fieldPath.length === 2 && fieldPath[0] === 'aggregateRating' && fieldPath[1] === 'ratingValue') {
      value = extractRating(schemaData);
    } else {
      value = schemaData;
      for (const part of fieldPath) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }
    }
    
    const exists = value !== undefined && value !== null && String(value).trim().length > 0;
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (!exists) {
      status = importance === 'critical' ? 'critical' : 'warning';
    }
    
    // Convert value to string for storage if it exists
    let valueStr = '';
    if (exists) {
      if (typeof value === 'object') {
        valueStr = value.name || value['@type'] || JSON.stringify(value);
      } else {
        valueStr = String(value);
      }
    }
    
    checks.push({
      field: label,
      exists,
      value: exists ? valueStr : undefined,
      status,
      description: desc
    });
  };

  if (lowerType.includes('article') || lowerType.includes('blogposting') || lowerType.includes('newsarticle')) {
    checkField(['headline'], 'headline', 'critical', 'The main title of the article shown in search results.');
    checkField(['author'], 'author', 'critical', 'Specifies the creator of the article (important for Google E-E-A-T).');
    checkField(['datePublished'], 'datePublished', 'critical', 'The date the article was first made available online.');
    checkField(['description'], 'description', 'warning', 'A brief summary of the article content.');
    checkField(['publisher'], 'publisher', 'warning', 'The organization publishing the article.');
    checkField(['image'], 'image', 'warning', 'A representative image URL for the article.');
  } else if (lowerType.includes('product')) {
    checkField(['name'], 'name', 'critical', 'The brand-specific title of the product.');
    checkField(['offers', 'price'], 'price', 'critical', 'The cost of the product (needed for rich snippet badges).');
    checkField(['offers', 'priceCurrency'], 'priceCurrency', 'critical', 'Currency symbol or ISO code (e.g., USD, MAD).');
    checkField(['brand'], 'brand', 'warning', 'The brand manufacturer of the product.');
    checkField(['description'], 'description', 'warning', 'The main content or summary of the product description.');
    checkField(['aggregateRating', 'ratingValue'], 'ratingValue', 'warning', 'Average user rating score.');
    checkField(['image'], 'image', 'warning', 'URLs of high-resolution product photos.');
  } else if (lowerType.includes('localbusiness') || lowerType.includes('restaurant') || lowerType.includes('store') || lowerType.includes('organization')) {
    checkField(['name'], 'name', 'critical', 'The registered name of the business.');
    checkField(['address'], 'address', 'critical', 'Physical mailing address of the establishment.');
    checkField(['telephone'], 'telephone', 'critical', 'Public contact phone number.');
    checkField(['image'], 'image', 'warning', 'An image or logo of the business.');
    checkField(['openingHours'], 'openingHours', 'warning', 'Times of day when the business is open.');
    checkField(['geo'], 'geo', 'warning', 'Latitude and longitude coordinates.');
  } else {
    // Generic schema check
    checkField(['name'], 'name', 'critical', 'Name or label of this entity.');
    checkField(['description'], 'description', 'warning', 'Description of this entity.');
    checkField(['image'], 'image', 'warning', 'Image representing this entity.');
  }
  
  return checks;
}

export async function analyzeUrl(url: string, keyword?: string, rawHtmlInput?: string): Promise<AnalysisReport> {
  const timestamp = new Date().toISOString();
  
  try {
    let html = '';
    
    if (rawHtmlInput) {
      html = rawHtmlInput;
    } else {
      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('رابط غير صالح. يجب أن يبدأ بـ http:// أو https://');
      }

      try {
        new URL(url);
      } catch (e) {
        throw new Error('صيغة الرابط غير صالحة. يرجى التأكد من كتابة رابط صحيح بدون مسافات أو رموز غير مدعومة.');
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ExtractorBot/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
        },
        signal: AbortSignal.timeout(12000) // 12 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`فشل جلب الصفحة: ${response.status} ${response.statusText}`);
      }
      
      html = await response.text();
    }
    
    const $ = cheerio.load(html);
    
    // --- 1. Extract JSON-LD Schema ---
    let schemaAnalysis: SchemaAnalysis | null = null;
    const schemasFound: { type: string; data: any }[] = [];
    
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const rawText = $(element).text().trim();
        if (rawText) {
          const parsed = JSON.parse(rawText);
          findAllSchemas(parsed, schemasFound);
        }
      } catch (e) {
        // Skip malformed JSON scripts
      }
    });
    
    if (schemasFound.length > 0) {
      // Prioritize Article, Product, LocalBusiness, then Organization, then whatever is first
      let targetSchema = schemasFound.find(s => {
        const t = s.type.toLowerCase();
        return t.includes('article') || t.includes('blogposting') || t.includes('newsarticle');
      });
      
      if (!targetSchema) {
        targetSchema = schemasFound.find(s => s.type.toLowerCase().includes('product'));
      }
      
      if (!targetSchema) {
        targetSchema = schemasFound.find(s => s.type.toLowerCase().includes('localbusiness') || s.type.toLowerCase().includes('restaurant') || s.type.toLowerCase().includes('store'));
      }
      
      if (!targetSchema) {
        targetSchema = schemasFound.find(s => s.type.toLowerCase().includes('organization'));
      }
      
      if (!targetSchema) {
        targetSchema = schemasFound[0];
      }
      
      const type = targetSchema.type;
      const rawData = targetSchema.data;
      const completenessCheck = runSchemaCompletenessCheck(type, rawData);
      const missingFieldsCount = completenessCheck.filter(c => c.status !== 'good').length;
      
      // Build visual extractedData map
      const extractedData: Record<string, any> = {};
      completenessCheck.forEach(c => {
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
    
    // --- 2. Extract Main Content Text ---
    const bodyClone = $('body').clone();
    
    // Remove unwanted interactive, styled, navigational, and non-content tags
    bodyClone.find('script, style, header, footer, nav, noscript, iframe, svg, head, aside, form, button, select, option').remove();
    
    // Remove common advertisement/social containers
    bodyClone.find('[class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"], .ads, .ad, #ads, #ad, [class*="advertisement"], [id*="advertisement"], .social-share, .newsletter-signup').remove();
    
    const textContent = bodyClone.text();
    // Normalize spacing and extract alphanumeric/multilingual characters
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    
    // Split into words (supporting Latin and Arabic characters)
    const wordsList = cleanText.split(/[\s,،.?!;:\-()"'’«»]+/u).filter(w => w.length > 1);
    const wordCount = wordsList.length;
    
    // --- 3. Keyword Density Analysis ---
    let keywordAnalysis: KeywordResult | null = null;
    if (keyword && keyword.trim().length > 0) {
      const kw = keyword.trim().toLowerCase();
      const escapedKw = escapeRegExp(kw);
      
      // Search with word boundary, but fallback if word boundaries are tricky (e.g. Arabic prefixing/suffixing or sub-tokens)
      const regexWordBoundary = new RegExp(`\\b${escapedKw}\\b`, 'gi');
      let count = (cleanText.match(regexWordBoundary) || []).length;
      
      // Fallback substring count if word boundaries return 0 but term exists
      if (count === 0 && cleanText.toLowerCase().includes(kw)) {
        const regexSub = new RegExp(escapedKw, 'gi');
        count = (cleanText.match(regexSub) || []).length;
      }
      
      const density = wordCount > 0 ? (count / wordCount) * 100 : 0;
      
      let status: 'too-low' | 'good' | 'stuffed' = 'good';
      let recommendation = '';
      
      if (density < 0.5) {
        status = 'too-low';
        recommendation = `نسبة الكلمة المفتاحية (${density.toFixed(2)}%) منخفضة جداً. لزيادة الظهور وتحسين السيو، حاول استخدام الكلمة المفتاحية بشكل طبيعي في العناوين والفقرات الأولى.`;
      } else if (density > 2.5) {
        status = 'stuffed';
        recommendation = `نسبة الكلمة المفتاحية (${density.toFixed(2)}%) مرتفعة جداً (حشو الكلمات - Keyword Stuffing). قد يعاقب جوجل الصفحة على هذا التكرار الزائد. حاول تقليل التكرار واستخدام مرادفات طبيعية.`;
      } else {
        status = 'good';
        recommendation = `ممتاز! نسبة الكلمة المفتاحية (${density.toFixed(2)}%) مثالية جداً وتقع في النطاق الآمن الطبيعي (0.5% - 2.5%).`;
      }
      
      keywordAnalysis = {
        keyword: keyword.trim(),
        count,
        density,
        status,
        recommendation
      };
    }
    
    // --- 4. Top Keywords Extraction ---
    const wordFrequencies: Record<string, number> = {};
    wordsList.forEach(rawWord => {
      const word = rawWord.toLowerCase().replace(/[^a-zA-Z0-9أ-ي]/g, '');
      if (word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
        wordFrequencies[word] = (wordFrequencies[word] || 0) + 1;
      }
    });
    
    const topKeywords: TopKeyword[] = Object.entries(wordFrequencies)
      .map(([word, count]) => ({
        word,
        count,
        density: wordCount > 0 ? (count / wordCount) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
      
    // --- 5. Basic SEO Audit ---
    const title = $('title').first().text().trim();
    const titleLength = title.length;
    
    const metaDescription = $('meta[name="description"]').first().attr('content')?.trim() || '';
    const metaDescriptionLength = metaDescription.length;
    
    const h1s: string[] = [];
    $('h1').each((_, el) => {
      const t = $(el).text().trim();
      if (t) h1s.push(t);
    });
    const h1Count = h1s.length;
    
    const h2s: string[] = [];
    $('h2').each((_, el) => {
      const t = $(el).text().trim();
      if (t) h2s.push(t);
    });
    const h2Count = h2s.length;
    
    let totalImages = 0;
    let imagesWithAlt = 0;
    $('img').each((_, el) => {
      totalImages++;
      const alt = $(el).attr('alt');
      if (alt && alt.trim().length > 0) {
        imagesWithAlt++;
      }
    });
    
    const imagesWithoutAlt = totalImages - imagesWithAlt;
    const altPercentage = totalImages > 0 ? (imagesWithAlt / totalImages) * 100 : 100;
    
    // Run score calculations and populate detailed check items
    const checks: SeoCheckItem[] = [];
    let score = 100;
    
    // Title checks
    if (titleLength === 0) {
      score -= 20;
      checks.push({
        name: 'العنوان (Title Tag)',
        status: 'danger',
        value: 'غير متوفر',
        message: 'الصفحة تفتقر تماماً إلى عنوان <title> وهو المعيار الأول للأرشفة.',
        recommendation: 'يجب إضافة وسم <title> فوراً ويحتوي على الكلمة المفتاحية الأساسية في البداية.'
      });
    } else if (titleLength < 40) {
      score -= 5;
      checks.push({
        name: 'طول العنوان (Title Length)',
        status: 'warning',
        value: `${titleLength} حرف`,
        message: 'عنوان الصفحة قصير جداً وقد يفوت فرصة جذب نقرات إضافية.',
        recommendation: 'اجعل طول العنوان بين 45 و 60 حرفاً لجعله جذاباً وواضحاً في نتائج البحث.'
      });
    } else if (titleLength > 65) {
      score -= 5;
      checks.push({
        name: 'طول العنوان (Title Length)',
        status: 'warning',
        value: `${titleLength} حرف`,
        message: 'العنوان طويل جداً وقد يتم قطعه في صفحة نتائج البحث من Google.',
        recommendation: 'اختصر العنوان ليكون أقل من 60 أو 65 حرفاً لتجنب ظهور النقاط الثلاث (...).'
      });
    } else {
      checks.push({
        name: 'العنوان (Title Tag)',
        status: 'good',
        value: `${titleLength} حرف (${title.substring(0, 30)}...)`,
        message: 'طول العنوان مثالي وهيكل الوسم ممتاز.',
        recommendation: 'لا حاجة للتغيير. حافظ على الكلمة المفتاحية في البداية.'
      });
    }
    
    // Meta Description checks
    if (metaDescriptionLength === 0) {
      score -= 20;
      checks.push({
        name: 'الوصف (Meta Description)',
        status: 'danger',
        value: 'غير متوفر',
        message: 'الصفحة تفتقر لوصف الميتا، مما يجعل محركات البحث تستقطع جملاً عشوائية من الصفحة.',
        recommendation: 'أضف وسماً بـ <meta name="description"> يلخص محتوى الصفحة لجذب الزوار.'
      });
    } else if (metaDescriptionLength < 100) {
      score -= 5;
      checks.push({
        name: 'طول الوصف (Description Length)',
        status: 'warning',
        value: `${metaDescriptionLength} حرف`,
        message: 'الوصف قصير جداً وقد لا يوفر سياقاً كافياً للباحثين.',
        recommendation: 'قم بزيادة الوصف ليصبح بين 120 و 160 حرفاً لإعطاء تفاصيل كافية ومقنعة للنقر.'
      });
    } else if (metaDescriptionLength > 165) {
      score -= 5;
      checks.push({
        name: 'طول الوصف (Description Length)',
        status: 'warning',
        value: `${metaDescriptionLength} حرف`,
        message: 'الوصف طويل جداً وسيظهر مقطوعاً في نتائج بحث الأجهزة الذكية والحواسيب.',
        recommendation: 'قم بتلخيص الوصف ليكون بين 120 و 155 حرفاً للظهور بشكل كامل.'
      });
    } else {
      checks.push({
        name: 'الوصف (Meta Description)',
        status: 'good',
        value: `${metaDescriptionLength} حرف`,
        message: 'طول الوصف مثالي وسينعكس بشكل رائع في نتائج البحث.',
        recommendation: 'لا حاجة للتغيير. تأكد فقط أنه يدفع المستخدم للنقر (Call to action).'
      });
    }
    
    // H1 Checks
    if (h1Count === 0) {
      score -= 15;
      checks.push({
        name: 'وسوم العناوين H1',
        status: 'danger',
        value: '0 وسوم',
        message: 'الصفحة لا تحتوي على أي عنوان H1. هذا يصعب فهم فكرة الصفحة الرئيسية لدى الروبوتات.',
        recommendation: 'يجب إدراج عنوان H1 وحيد ومميز في أعلى الصفحة يمثل العنوان الرئيسي للمقال أو المنتج.'
      });
    } else if (h1Count > 1) {
      score -= 8;
      checks.push({
        name: 'وسوم العناوين H1',
        status: 'warning',
        value: `${h1Count} وسوم`,
        message: 'تحتوي الصفحة على أكثر من وسم H1 واحد. هذا قد يشتت تركيز خوارزميات السيو حول الموضوع الأساسي.',
        recommendation: 'يُفضل تقليص وسوم H1 ليكون وسماً واحداً فقط للموضوع الأساسي، واستخدام H2 أو H3 للعناوين الفرعية.'
      });
    } else {
      checks.push({
        name: 'وسوم العناوين H1',
        status: 'good',
        value: 'وسم واحد H1',
        message: 'مثالي! الصفحة تضم وسماً رئيسياً واحداً H1 كما تمليه معايير السيو الحديثة.',
        recommendation: 'ممتاز. تأكد من احتواء هذا العنوان الفريد على كلمتك المفتاحية الأساسية.'
      });
    }
    
    // H2 Checks
    if (h2Count === 0) {
      score -= 5;
      checks.push({
        name: 'العناوين الفرعية H2',
        status: 'warning',
        value: '0 وسوم',
        message: 'الصفحة لا تضم أي عنوان فرعي H2 لتنظيم بنية النص.',
        recommendation: 'قم بإضافة عناوين فرعية H2 لتقسيم النص لفقرات يسهل على القارئ ومحركات البحث تصفحها.'
      });
    } else {
      checks.push({
        name: 'العناوين الفرعية H2',
        status: 'good',
        value: `${h2Count} وسوم H2`,
        message: 'هيكل تقسيم الصفحة جيد باستخدام العناوين الفرعية.',
        recommendation: 'ممتاز. تنظيم بنية النص يساعد على تحسين تجربة القراءة والاحتفاظ بالزائر.'
      });
    }
    
    // Image ALT Checks
    if (totalImages > 0) {
      if (altPercentage === 100) {
        checks.push({
          name: 'نصوص صور بديلة ALT',
          status: 'good',
          value: '100% مغطاة',
          message: `جميع الصور بالصفحة (${totalImages} صور) تمتلك وسوم ALT وصفية.`,
          recommendation: 'رائع! هذا يضمن فهرسة الصور في قسم بحث الصور بـ Google ويسهل إمكانية الوصول.'
        });
      } else if (altPercentage < 50) {
        score -= 10;
        checks.push({
          name: 'نصوص صور بديلة ALT',
          status: 'danger',
          value: `${altPercentage.toFixed(0)}% مغطاة`,
          message: `هنالك ${imagesWithoutAlt} صور من أصل ${totalImages} لا تمتلك وسوم ALT توضيحية.`,
          recommendation: 'قم بإضافة نصوص بديلة ALT دقيقة وواضحة تصف محتوى كل صورة لمساعدة روبوتات جوجل.'
        });
      } else {
        score -= 5;
        checks.push({
          name: 'نصوص صور بديلة ALT',
          status: 'warning',
          value: `${altPercentage.toFixed(0)}% مغطاة`,
          message: `تفتقر ${imagesWithoutAlt} صورة لوصف ALT البديل.`,
          recommendation: 'يُستحسن تزويد بقية الصور بوصف ALT لتجعل الصفحة مثالية للوصول والأرشفة.'
        });
      }
    } else {
      checks.push({
        name: 'الصور بالصفحة',
        status: 'good',
        value: 'لا توجد صور',
        message: 'لا توجد صور بالصفحة لتقييم نصوصها البديلة.',
        recommendation: 'فكر في إضافة صور توضيحية غنية بالنصوص البديلة ALT لزيادة تفاعل الزوار مع المحتوى.'
      });
    }
    
    // Schema check in SEO
    if (!schemaAnalysis) {
      score -= 10;
      checks.push({
        name: 'بيانات Schema الهيكلية',
        status: 'danger',
        value: 'غير متوفرة',
        message: 'لم يتم العثور على أي كود Schema JSON-LD بالصفحة. هذا يحرمك من ظهور غني (Rich Snippets).',
        recommendation: 'أضف كود Schema JSON-LD مناسب لنوع صفحتك (مقال، منتج، أو نشاط محلي) في أسرع وقت.'
      });
    } else {
      checks.push({
        name: 'بيانات Schema الهيكلية',
        status: 'good',
        value: `${schemaAnalysis.type}`,
        message: `تم رصد كود Schema من نوع ${schemaAnalysis.type} بنجاح.`,
        recommendation: `تحقق من اكتمال كافة الحقول في قسم السكيمة المخصص لضمان تفعيل ميزات محرك البحث بالكامل.`
      });
    }
    
    // Ensure score is within boundaries
    score = Math.max(10, Math.min(100, score));
    
    const seoAudit: SeoAudit = {
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
      url: rawHtmlInput ? 'محتوى نصي مدخل يدوياً' : url,
      success: true,
      wordCount,
      extractedText: cleanText.substring(0, 1000), // Return sample of clean extracted text
      schema: schemaAnalysis,
      keywordAnalysis,
      topKeywords,
      seoAudit,
      readability,
      timestamp
    };
    
  } catch (error: any) {
    return {
      url: url,
      success: false,
      error: error.message || 'حدث خطأ غير متوقع أثناء تحليل الصفحة',
      wordCount: 0,
      extractedText: '',
      schema: null,
      keywordAnalysis: null,
      topKeywords: [],
      seoAudit: {
        title: '',
        titleLength: 0,
        metaDescription: '',
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
      readability: undefined,
      timestamp
    };
  }
}

/**
 * Counts syllables in a single word. Supports English vowels and estimates Arabic syllables.
 */
function countSyllablesInWord(word: string): number {
  const arabicRegex = /[\u0600-\u06FF]/;
  if (arabicRegex.test(word)) {
    // Robust Arabic syllable estimation for plain text (no harakat):
    // Standard Arabic word has syllables that align closely with long vowels (ا، و، ي).
    // An empirical approximation is: count of long vowels or a base minimum.
    const longVowels = (word.match(/[اوىي]/g) || []).length;
    return Math.max(1, Math.min(word.length, Math.round((word.length + longVowels) / 2)));
  }
  
  // English syllable count heuristic
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length === 0) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/**
 * Calculates readability of text using the standard Flesch Reading Ease and Flesch-Kincaid Grade Level formulas.
 */
function calculateReadability(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length === 0) {
    return {
      readingEase: 0,
      gradeLevel: 0,
      easeLabel: 'محتوى فارغ',
      easeDescription: 'لا يوجد محتوى نصي كافٍ لتحليل المقروئية.',
      gradeLabel: 'غير محدد',
      sentencesCount: 0,
      wordsCount: 0,
      syllablesCount: 0
    };
  }
  
  // Sentences: split on . ! ? or Arabic question mark ؟ and newlines
  const sentences = clean.split(/[.!?؟]+|\n+/).filter(s => s.trim().length > 2);
  const sentenceCount = Math.max(1, sentences.length);
  
  // Words: split on whitespace and punctuation
  const words = clean.split(/[\s,،.?!;:\-()"'’«»]+/u).filter(w => w.length > 0);
  const wordCount = Math.max(1, words.length);
  
  // Syllables
  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllablesInWord(word);
  }
  
  // Calculate average sentence length and average syllables per word
  const asl = wordCount / sentenceCount;
  const asw = totalSyllables / wordCount;
  
  // Flesch Reading Ease Formula
  let readingEase = 206.835 - (1.015 * asl) - (84.6 * asw);
  readingEase = Math.max(0, Math.min(100, readingEase));
  
  // Flesch-Kincaid Grade Level Formula
  let gradeLevel = (0.39 * asl) + (11.8 * asw) - 15.59;
  gradeLevel = Math.max(1, Math.min(18, gradeLevel));
  
  // Translate Flesch Reading Ease score to readable labels and descriptions in Arabic
  let easeLabel = '';
  let easeDescription = '';
  if (readingEase >= 90) {
    easeLabel = 'سهل جداً';
    easeDescription = 'محتوى سهل القراءة للغاية، ومناسب لأعمار 10 سنوات فما فوق (الصف الخامس الابتدائي).';
  } else if (readingEase >= 80) {
    easeLabel = 'سهل';
    easeDescription = 'سهل القراءة، ومناسب لطلاب الصف السادس الابتدائي. يسهل فهمه بواسطة معظم القراء العاديين.';
  } else if (readingEase >= 70) {
    easeLabel = 'سهل نسبياً';
    easeDescription = 'لغة واضحة وبسيطة، مناسب لطلاب الصف السابع (المرحلة الإعدادية).';
  } else if (readingEase >= 60) {
    easeLabel = 'قياسي / متوسط';
    easeDescription = 'لغة يومية قياسية، مناسب لطلاب الصفين الثامن والتاسع (المرحلة الإعدادية).';
  } else if (readingEase >= 50) {
    easeLabel = 'صعب نسبياً';
    easeDescription = 'مناسب لطلاب المرحلة الثانوية (الصفوف 10 إلى 12). يتطلب تركيزاً متوسطاً وقدرة قرائية جيدة.';
  } else if (readingEase >= 30) {
    easeLabel = 'صعب / أكاديمي';
    easeDescription = 'مناسب لطلاب الجامعات والخريجين. يتضمن مفردات تقنية أو بنية جمل معقدة وطويلة.';
  } else {
    easeLabel = 'صعب جداً / معقد';
    easeDescription = 'محتوى معقد جداً، مناسب للمتخصصين والأكاديميين وخريجي الدراسات العليا فقط.';
  }
  
  // Translate Flesch-Kincaid Grade Level to standard educational levels
  let gradeLabel = '';
  const roundedGrade = Math.round(gradeLevel);
  if (roundedGrade <= 5) {
    gradeLabel = 'الصف الخامس الابتدائي أو أقل';
  } else if (roundedGrade === 6) {
    gradeLabel = 'الصف السادس الابتدائي';
  } else if (roundedGrade === 7) {
    gradeLabel = 'الصف السابع (أول إعدادي)';
  } else if (roundedGrade === 8) {
    gradeLabel = 'الصف الثامن (ثاني إعدادي)';
  } else if (roundedGrade === 9) {
    gradeLabel = 'الصف التاسع (ثالث إعدادي)';
  } else if (roundedGrade === 10) {
    gradeLabel = 'الصف العاشر (أول ثانوي)';
  } else if (roundedGrade === 11) {
    gradeLabel = 'الصف الحادي عشر (ثاني ثانوي)';
  } else if (roundedGrade === 12) {
    gradeLabel = 'الصف الثاني عشر (ثالث ثانوي)';
  } else if (roundedGrade <= 16) {
    gradeLabel = 'المرحلة الجامعية (بكالوريوس)';
  } else {
    gradeLabel = 'الدراسات العليا والبحث العلمي';
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
