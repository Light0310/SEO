import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  FileCode, 
  Search, 
  Sparkles, 
  Copy, 
  Check, 
  Terminal, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowRight, 
  Download, 
  Plus, 
  Trash2, 
  ListOrdered,
  Eye,
  Settings,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisReport } from './types';
import { PYTHON_SCRIPTS, PythonFile } from './pythonScripts';

export default function App() {
  // Input states
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'html' | 'python' | 'schemaExtractor'>('single');
  const [url, setUrl] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [schemaUrl, setSchemaUrl] = useState<string>('');
  const [schemaLoading, setSchemaLoading] = useState<boolean>(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [fetchedSchemas, setFetchedSchemas] = useState<{ type: string; rawData: any; completenessCheck: any[]; missingFieldsCount: number }[]>([]);
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState<number | 'all'>('all');
  
  // Bulk analyzer states
  const [bulkUrls, setBulkUrls] = useState<string[]>([]);
  const [newBulkUrl, setNewBulkUrl] = useState<string>('');
  const [bulkReports, setBulkReports] = useState<AnalysisReport[]>([]);
  const [bulkIsLoading, setBulkIsLoading] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Single analysis results
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Copy state for code snippets
  const [selectedPythonFile, setSelectedPythonFile] = useState<number>(0);
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Active sub-view in results
  const [resultsSubTab, setResultsSubTab] = useState<'seo' | 'schema' | 'keywords' | 'rawText'>('seo');

  // Trigger single URL / HTML analysis
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'single' && !url) {
      setError('الرجاء إدخال رابط موقع صالح لبدء الفحص.');
      return;
    }
    if (activeTab === 'html' && !rawHtml) {
      setError('الرجاء كتابة أو لصق كود HTML لبدء التحليل.');
      return;
    }

    if (activeTab === 'single') {
      const checkUrl = url.trim();
      const targetUrl = checkUrl.startsWith('http') ? checkUrl : `https://${checkUrl}`;
      try {
        new URL(targetUrl);
      } catch (_) {
        setError('صيغة الرابط غير صالحة. يرجى التأكد من كتابة رابط صحيح بدون مسافات أو رموز غير مدعومة.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const payload = {
        url: activeTab === 'single' ? (url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`) : '',
        keyword: keyword,
        rawHtml: activeTab === 'html' ? rawHtml : undefined
      };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setReport(data);
      } else {
        setError(data.error || 'فشل الاتصال بالخادم أو جلب الصفحة المطلوبة. تأكد من صحة الرابط وجرب مجدداً.');
      }
    } catch (err: any) {
      setError('حدث خطأ في الشبكة أثناء تحليل الرابط. يرجى التحقق من الرابط وإعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch schemas directly from external URL using AllOrigins CORS proxy and DOMParser
  const handleFetchSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemaUrl) {
      setSchemaError('الرجاء إدخال رابط صالح لجلب الـ Schema.');
      return;
    }

    let targetUrl = schemaUrl.trim();
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      new URL(targetUrl);
    } catch (_) {
      setSchemaError('صيغة الرابط غير صالحة. يرجى التأكد من كتابة رابط صحيح بدون مسافات أو رموز غير مدعومة.');
      return;
    }

    setSchemaLoading(true);
    setSchemaError(null);
    setFetchedSchemas([]);
    setSelectedSchemaIndex('all');

    try {
      const proxyUrl = `/api/proxy-fetch?url=${encodeURIComponent(targetUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `فشل الاتصال بالخادم: ${response.status} ${response.statusText}`);
      }
      
      if (!data || !data.contents) {
        throw new Error('لم يتم استرجاع محتوى الصفحة.');
      }

      const html = data.contents;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const scriptElements = doc.querySelectorAll('script[type="application/ld+json"]');
      const extractedList: { type: string; rawData: any; completenessCheck: any[]; missingFieldsCount: number }[] = [];

      const runClientCompletenessCheck = (typeStr: string, schemaObj: any) => {
        const checks: any[] = [];
        const lowerType = typeStr.toLowerCase();
        
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

        const checkField = (fieldPath: string[], label: string, importance: 'critical' | 'warning', desc: string) => {
          let value: any;
          if (fieldPath.length === 2 && fieldPath[0] === 'offers' && fieldPath[1] === 'price') {
            value = extractPriceAndCurrency(schemaObj).price;
          } else if (fieldPath.length === 2 && fieldPath[0] === 'offers' && fieldPath[1] === 'priceCurrency') {
            value = extractPriceAndCurrency(schemaObj).currency;
          } else if (fieldPath.length === 2 && fieldPath[0] === 'aggregateRating' && fieldPath[1] === 'ratingValue') {
            value = extractRating(schemaObj);
          } else {
            value = schemaObj;
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
          let status = exists ? 'good' : (importance === 'critical' ? 'critical' : 'warning');
          
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
          checkField(['headline'], 'headline', 'critical', 'العنوان الرئيسي للمقال المعروض في نتائج البحث.');
          checkField(['author'], 'author', 'critical', 'يحدد منشئ المقال (مهم لـ Google E-E-A-T).');
          checkField(['datePublished'], 'datePublished', 'critical', 'تاريخ نشر المقال أول مرة.');
          checkField(['description'], 'description', 'warning', 'وصف أو ملخص قصير للمقال.');
          checkField(['publisher'], 'publisher', 'warning', 'الجهة الناشرة للمقال.');
          checkField(['image'], 'image', 'warning', 'رابط الصورة البارزة للمقال.');
        } else if (lowerType.includes('product')) {
          checkField(['name'], 'name', 'critical', 'الاسم الخاص بالمنتج.');
          checkField(['offers', 'price'], 'price', 'critical', 'سعر المنتج (مطلوب لظهور السعر في جوجل).');
          checkField(['offers', 'priceCurrency'], 'priceCurrency', 'critical', 'عملة السعر (مثال: USD, MAD).');
          checkField(['brand'], 'brand', 'warning', 'العلامة التجارية أو الشركة المصنعة.');
          checkField(['description'], 'description', 'warning', 'تفاصيل ووصف المنتج.');
          checkField(['aggregateRating', 'ratingValue'], 'ratingValue', 'warning', 'متوسط تقييم العملاء.');
          checkField(['image'], 'image', 'warning', 'روابط صور المنتج.');
        } else if (lowerType.includes('localbusiness') || lowerType.includes('restaurant') || lowerType.includes('store') || lowerType.includes('organization')) {
          checkField(['name'], 'name', 'critical', 'الاسم الرسمي للمؤسسة/الشركة.');
          checkField(['address'], 'address', 'critical', 'العنوان الجغرافي للمقر الرئيسي.');
          checkField(['telephone'], 'telephone', 'critical', 'هاتف التواصل العام.');
          checkField(['image'], 'image', 'warning', 'شعار الشركة أو صور المقر.');
          checkField(['openingHours'], 'openingHours', 'warning', 'ساعات العمل اليومية والأسبوعية.');
          checkField(['geo'], 'geo', 'warning', 'الإحداثيات الجغرافية (خطوط الطول والعرض).');
        } else if (lowerType.includes('faqpage')) {
          checkField(['mainEntity'], 'mainEntity', 'critical', 'قائمة الأسئلة والأجوبة الرئيسية.');
        } else {
          checkField(['name'], 'name', 'critical', 'الاسم الخاص بهذا الكائن أو العنصر.');
          checkField(['description'], 'description', 'warning', 'الوصف أو التعريف الخاص بهذا الكائن.');
          checkField(['image'], 'image', 'warning', 'رابط الصورة المعبرة عن هذا الكائن.');
        }
        return checks;
      };

      const findAllSchemas = (obj: any) => {
        if (!obj) return;
        if (Array.isArray(obj)) {
          obj.forEach(item => findAllSchemas(item));
        } else if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach((item: any) => findAllSchemas(item));
        } else if (typeof obj === 'object') {
          const type = obj['@type'];
          if (type) {
            const types = Array.isArray(type) ? type : [type];
            types.forEach((t: string) => {
              const completeness = runClientCompletenessCheck(t, obj);
              const missingFieldsCount = completeness.filter(c => c.status !== 'good').length;
              extractedList.push({
                type: t,
                rawData: obj,
                completenessCheck: completeness,
                missingFieldsCount
              });
            });
          } else if (obj['@context']) {
            const completeness = runClientCompletenessCheck('Structured Data', obj);
            const missingFieldsCount = completeness.filter(c => c.status !== 'good').length;
            extractedList.push({
              type: 'Structured Data',
              rawData: obj,
              completenessCheck: completeness,
              missingFieldsCount
            });
          }
        }
      };

      scriptElements.forEach((script) => {
        try {
          const rawText = script.textContent?.trim();
          if (rawText) {
            const parsed = JSON.parse(rawText);
            findAllSchemas(parsed);
          }
        } catch (e) {
          // ignore parsing error for this script element
        }
      });

      if (extractedList.length === 0) {
        setSchemaError('نجح جلب الصفحة، ولكن لم يتم العثور على أي كود Schema JSON-LD داخلها.');
      } else {
        setFetchedSchemas(extractedList);
      }
    } catch (err: any) {
      console.error(err);
      setSchemaError(err.message || 'حدث خطأ أثناء جلب أو تحليل بيانات الموقع. تأكد من صحة الرابط أو جرب لاحقاً.');
    } finally {
      setSchemaLoading(false);
    }
  };

  // Add URL to bulk list
  const addBulkUrl = () => {
    if (!newBulkUrl) return;
    let formatted = newBulkUrl.trim();
    if (!formatted.startsWith('http')) {
      formatted = 'https://' + formatted;
    }
    if (!bulkUrls.includes(formatted)) {
      setBulkUrls([...bulkUrls, formatted]);
    }
    setNewBulkUrl('');
  };

  // Remove URL from bulk list
  const removeBulkUrl = (index: number) => {
    setBulkUrls(bulkUrls.filter((_, i) => i !== index));
  };

  // Run sequential bulk analysis
  const handleBulkAnalyze = async () => {
    if (bulkUrls.length === 0) {
      setError('الرجاء إضافة روابط أولاً للتحليل المتعدد.');
      return;
    }
    
    setBulkIsLoading(true);
    setBulkReports([]);
    setError(null);
    setBulkProgress({ current: 0, total: bulkUrls.length });

    const reports: AnalysisReport[] = [];
    
    for (let i = 0; i < bulkUrls.length; i++) {
      setBulkProgress({ current: i + 1, total: bulkUrls.length });
      const targetUrl = bulkUrls[i];
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl, keyword })
        });
        const data = await response.json();
        reports.push(data);
      } catch (err) {
        reports.push({
          url: targetUrl,
          success: false,
          error: 'فشل الاتصال بالرابط',
          wordCount: 0,
          extractedText: '',
          schema: null,
          keywordAnalysis: null,
          topKeywords: [],
          seoAudit: {
            title: '', titleLength: 0, metaDescription: '', metaDescriptionLength: 0,
            h1Count: 0, h1s: [], h2Count: 0, h2s: [], totalImages: 0, imagesWithAlt: 0,
            imagesWithoutAlt: 0, altPercentage: 0, score: 0, checks: []
          },
          timestamp: new Date().toISOString()
        });
      }
    }
    
    setBulkReports(reports);
    setBulkIsLoading(false);
  };

  // Copy code utility
  const copyToClipboard = (text: string, index: number | null) => {
    navigator.clipboard.writeText(text);
    if (index !== null) {
      setCopiedFileIndex(index);
      setTimeout(() => setCopiedFileIndex(null), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  // Load a preset example for testing
  const loadPresetExample = (type: 'article' | 'product') => {
    if (type === 'article') {
      setSchemaUrl('https://www.aljazeera.net/tech');
      setUrl('https://www.aljazeera.net/tech');
      setKeyword('التكنولوجيا');
      setRawHtml(`<!DOCTYPE html>
<html>
<head>
  <title>مستقبل الذكاء الاصطناعي وتأثيره على الوظائف التقنية في العالم العربي</title>
  <meta name="description" content="مقال تحليلي شامل يستكشف مستقبل الذكاء الاصطناعي والتغيرات الكبرى في سوق العمل والمهن المستقبلية للشباب العربي.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": "مستقبل الذكاء الاصطناعي وتأثيره على الوظائف التقنية",
    "image": ["https://example.com/images/ai-jobs.jpg"],
    "datePublished": "2026-06-25T12:00:00+03:00",
    "author": {
      "@type": "Person",
      "name": "ياسين الإدريسي"
    },
    "publisher": {
      "@type": "Organization",
      "name": "الجزيرة تقنية",
      "logo": {
        "@type": "ImageObject",
        "url": "https://example.com/logo.png"
      }
    }
  }
  </script>
</head>
<body>
  <header>
    <nav><ul><li>الرئيسية</li><li>أخبار</li></ul></nav>
  </header>
  <main>
    <h1>مستقبل الذكاء الاصطناعي وتأثيره على الوظائف التقنية</h1>
    <h2>الذكاء الاصطناعي يعيد رسم الخرائط المهنية</h2>
    <p>تتسارع وتيرة التطور في مجالات الذكاء الاصطناعي بشكل لم يسبق له مثيل. أصبح التكنولوجيا الحديثة قادرة على إنجاز مهام معقدة كانت حكراً على البشر. يثير هذا التحول قلقاً كبيراً حول مستقبل الوظائف التقنية في العالم العربي، حيث يتخوف الكثيرون من إحلال الآلات الذكية مكان المبرمجين والمصممين.</p>
    
    <h2>المهارات الأساسية للبقاء في عصر الأتمتة</h2>
    <p>يرى الخبراء أن التكنولوجيا لن تقضي على الوظائف بل ستغير طبيعتها. على المهندسين والشباب العربي اكتساب مهارات جديدة للتعامل مع الذكاء الاصطناعي كأداة مساعدة لرفع الكفاءة والإنتاجية بدلاً من اعتباره تهديداً منافساً.</p>
    <img src="ai-workflow.jpg" alt="سير العمل باستخدام الذكاء الاصطناعي">
  </main>
  <footer>حقوق النشر محفوظة</footer>
</body>
</html>`);
    } else {
      setSchemaUrl('https://www.example-store.com/phone-x');
      setUrl('https://www.example-store.com/phone-x');
      setKeyword('هاتف');
      setRawHtml(`<!DOCTYPE html>
<html>
<head>
  <title>هاتف ألترا برو ماكس 5G - متجر الأجهزة الذكية</title>
  <meta name="description" content="اشترِ هاتف ألترا برو ماكس 5G بأفضل سعر في المغرب مع شحن سريع مجاني وضمان لمدة سنتين. تفقد المواصفات والأسعار والتقييمات الآن.">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "هاتف ألترا برو ماكس 5G",
    "image": "https://example-store.com/images/phone-ultra.jpg",
    "description": "هاتف ذكي خارق بكاميرا 200 ميجابكسل ومعالج ألترا سنابدراجون.",
    "brand": {
      "@type": "Brand",
      "name": "سامسونج المغرب"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "MAD",
      "price": "8900.00",
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "124"
    }
  }
  </script>
</head>
<body>
  <nav>قائمة المتجر</nav>
  <div class="product-container">
    <h1>هاتف ألترا برو ماكس 5G المتطور</h1>
    <h2>المواصفات الخارقة لهاتف الألترا الجديد</h2>
    <p>نقدم لكم هاتف ألترا برو الجديد كلياً مع دعم شبكات الجيل الخامس 5G. يتميز هذا الهاتف بشاشة أموليد عملاقة بمعدل تحديث 120 هرتز، مما يمنحك تجربة استخدام وتصفح لا مثيل لها.</p>
    <img src="phone-front.jpg" alt="الواجهة الأمامية لهاتف ألترا برو ماكس">
    <img src="phone-back.jpg" alt="الكاميرات الخلفية لهاتف ألترا">
  </div>
</body>
</html>`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-10" dir="rtl">
      {/* Background radial highlights */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Container */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">مستخرج السكيمة وفاحص السيو</h1>
              <p className="text-xs text-slate-500 font-medium">Advanced Content Extraction Engine v2.4</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-100">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> النظام جاهز
            </div>
            <button
              onClick={() => loadPresetExample('article')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200 cursor-pointer"
            >
              مثال مقال (Article)
            </button>
            <button
              onClick={() => loadPresetExample('product')}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200 cursor-pointer"
            >
              مثال منتج (Product)
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
          {[
            { id: 'single', label: 'فحص رابط مفرد', icon: Globe },
            { id: 'schemaExtractor', label: 'مستخرج السكيمة المباشر (Fetch Schema)', icon: Search },
            { id: 'html', label: 'تحليل كود HTML مسبق', icon: FileCode },
            { id: 'bulk', label: 'تحليل روابط متعددة (دفعات)', icon: ListOrdered },
            { id: 'python', label: 'كود Python للمطورين', icon: Terminal }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setError(null);
                }}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Tool Description banner */}
        <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 mb-8 flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 leading-relaxed">
            {activeTab === 'single' && 'أدخل رابط صفحة الويب والكلمة المفتاحية المستهدفة ليقوم النظام بجلب كود HTML واستخلاص كود السكيمة JSON-LD، ثم تصفية النصوص وحساب الكثافة وإجراء فحص شامل لعناصر السيو الرئيسية.'}
            {activeTab === 'schemaExtractor' && 'أدخل رابط أي موقع خارجي لاستخراج وقراءة جميع السكيمات والمخططات الهيكلية (JSON-LD) المكتشفة بالكامل مع فحص فني لمدى اكتمال حقولها.'}
            {activeTab === 'html' && 'إذا كانت الصفحة محمية بجدار ناري أو تريد اختبار تعديل محلي، الصق كود الـ HTML هنا مع تحديد الكلمة المفتاحية المستهدفة لتطبيق الفحوصات الفنية فوراً وبشكل دقيق.'}
            {activeTab === 'bulk' && 'أدخل قائمة من الروابط لتحليلها ومقارنتها بشكل تسلسلي. ممتاز لمقارنة صفحات المقالات المتشابهة أو المنتجات وتقييم اكتمال البيانات والـ SEO الإجمالي.'}
            {activeTab === 'python' && 'تبحث عن الكود المصدري الأصلي بـ Python؟ قمنا ببرمجة 6 ملفات برمجية مستقلة ومنظمة ومنقحة تماماً يمكنك تصفحها، نسخها، وتنزيلها لتشغيلها محلياً على جهازك بسلاسة.'}
          </div>
        </div>

        {/* Input Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          <div className={`bg-white border border-slate-200 rounded-2xl p-6 shadow-sm ${activeTab === 'python' ? 'lg:col-span-12' : 'lg:col-span-5'}`}>
            {activeTab !== 'python' && (
              <form onSubmit={activeTab === 'schemaExtractor' ? handleFetchSchema : handleAnalyze} className="space-y-5">
                {activeTab === 'single' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">رابط موقع الويب (URL)</label>
                    <div className="relative">
                      <Globe className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="https://example.com/my-article"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'schemaExtractor' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">رابط الموقع الخارجي لجلب السكيمة (Fetch Schema)</label>
                    <div className="relative">
                      <Globe className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="https://example.com/product-or-article"
                        value={schemaUrl}
                        onChange={(e) => setSchemaUrl(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'html' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">كود HTML المصدري للموقع</label>
                    <textarea
                      placeholder="<!DOCTYPE html> \n<html>..."
                      value={rawHtml}
                      onChange={(e) => setRawHtml(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-xs font-mono"
                      dir="ltr"
                    />
                  </div>
                )}

                {activeTab === 'bulk' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">إضافة روابط للتحليل المتعدد</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="example.com/page"
                          value={newBulkUrl}
                          onChange={(e) => setNewBulkUrl(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={addBulkUrl}
                          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center justify-center border border-slate-200 cursor-pointer"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {bulkUrls.length > 0 && (
                      <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto bg-slate-50 space-y-2">
                        {bulkUrls.map((bUrl, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-100 rounded-lg text-xs shadow-sm">
                            <span className="font-mono text-slate-600 truncate" dir="ltr">{bUrl}</span>
                            <button
                              type="button"
                              onClick={() => removeBulkUrl(idx)}
                              className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab !== 'schemaExtractor' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">الكلمة المفتاحية المستهدفة (Keyword) - اختياري</label>
                    <input
                      type="text"
                      placeholder="أدخل الكلمة لحساب الكثافة (مثال: الذكاء الاصطناعي)"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                    />
                  </div>
                )}

                {activeTab === 'schemaExtractor' ? (
                  <button
                    type="submit"
                    disabled={schemaLoading}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {schemaLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        جاري جلب واستخراج السكيمات...
                      </span>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Fetch Schema (جلب السكيمة)
                      </>
                    )}
                  </button>
                ) : activeTab !== 'bulk' ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        جاري جلب وتحليل الصفحة...
                      </span>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        بدء استخراج البيانات وفحص السيو
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBulkAnalyze}
                    disabled={bulkIsLoading || bulkUrls.length === 0}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {bulkIsLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        جاري فحص الروابط ({bulkProgress.current} / {bulkProgress.total})...
                      </span>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        تشغيل فحص الدفعات لـ {bulkUrls.length} روابط
                      </>
                    )}
                  </button>
                )}
              </form>
            )}

            {/* Python Code Section */}
            {activeTab === 'python' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sidebar File Selector */}
                <div className="lg:col-span-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">هيكل كود Python المقترح</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {PYTHON_SCRIPTS.map((pfile, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPythonFile(idx)}
                        className={`w-full text-right px-4 py-3 text-xs transition-all flex items-center justify-between cursor-pointer ${
                          selectedPythonFile === idx 
                            ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                            : 'text-slate-600 hover:text-slate-950 hover:bg-white'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono">{pfile.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">{pfile.description}</span>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 transition-all ${selectedPythonFile === idx ? 'opacity-100 transform translate-x-1' : 'opacity-0'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Viewer */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[550px] shadow-lg">
                    <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-semibold font-mono text-indigo-400">{PYTHON_SCRIPTS[selectedPythonFile].name}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(PYTHON_SCRIPTS[selectedPythonFile].code, selectedPythonFile)}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md transition-all cursor-pointer"
                      >
                        {copiedFileIndex === selectedPythonFile ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ الكود</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 text-left" dir="ltr">
                      <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre select-all">
                        <code>{PYTHON_SCRIPTS[selectedPythonFile].code}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Requirements Note */}
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
                    <div>
                      <span className="font-bold text-slate-800">طريقة التشغيل المحلية:</span> قم بتثبيت مكتبة التحليل أولاً: <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-indigo-600 font-mono">pip install beautifulsoup4</code>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">تتطلب ملفات BeautifulSoup4 و Python 3.7+</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Side Info Panel */}
          {activeTab !== 'python' && (
            <div className="lg:col-span-7 flex flex-col justify-between">
              <AnimatePresence mode="wait">
                {/* Error Banner */}
                {error && (
                  <motion.div
                    key="error-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 mb-6 shadow-sm"
                  >
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">عذراً، حدث خطأ أثناء فحص البيانات</h4>
                      <p className="text-xs text-rose-600 mt-1">{error}</p>
                    </div>
                  </motion.div>
                )}

                {/* Bulk Results Table */}
                {activeTab === 'bulk' && bulkReports.length > 0 && (
                  <motion.div
                    key="bulk-results"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <h3 className="font-bold text-sm text-slate-800">مقارنة الروابط المحللة بالدفعات</h3>
                      <button
                        onClick={() => {
                          // Simple CSV generation
                          let csv = 'URL,Words,Schema Type,SEO Score\n';
                          bulkReports.forEach(r => {
                            csv += `"${r.url}",${r.wordCount},"${r.schema?.type || 'None'}",${r.seoAudit.score}\n`;
                          });
                          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8-sig;' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.setAttribute('download', `seo_bulk_report.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        تصدير لـ CSV
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                            <th className="py-3 px-2">الرابط (URL)</th>
                            <th className="py-3 px-2">مجموع الكلمات</th>
                            <th className="py-3 px-2">نوع السكيمة</th>
                            <th className="py-3 px-2">تأثير السيو (SEO)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {bulkReports.map((reportItem, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-2 font-mono text-slate-600 truncate max-w-[150px]" dir="ltr">{reportItem.url}</td>
                              <td className="py-3 px-2 font-semibold text-slate-800">{reportItem.wordCount} كلمة</td>
                              <td className="py-3 px-2">
                                {reportItem.schema ? (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full font-mono text-[10px] font-semibold">
                                    {reportItem.schema.type}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">غير متوفر</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <span className={`px-2 py-0.5 rounded font-bold text-[11px] border ${
                                  reportItem.seoAudit.score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                  reportItem.seoAudit.score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                }`}>
                                  {reportItem.seoAudit.score} / 100
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Schema Error Banner */}
                {activeTab === 'schemaExtractor' && schemaError && (
                  <motion.div
                    key="schema-error-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 mb-6 shadow-sm w-full"
                  >
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">عذراً، لم نتمكن من استخراج السكيمة</h4>
                      <p className="text-xs text-rose-600 mt-1">{schemaError}</p>
                    </div>
                  </motion.div>
                )}

                {/* Schema Extractor Empty State */}
                {activeTab === 'schemaExtractor' && fetchedSchemas.length === 0 && !schemaLoading && (
                  <motion.div
                    key="schema-extractor-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 border-dashed rounded-2xl min-h-[300px] shadow-sm w-full"
                  >
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">مستخرج السكيمات الذكي</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                      أدخل رابط أي موقع خارجي في الخانة الجانبية واضغط على <strong>Fetch Schema</strong> لجلب كود الـ HTML واستخراج كافة السكيمات المحتواة بداخل الصفحة وعرضها بشكل تفصيلي.
                    </p>
                  </motion.div>
                )}

                {/* Schema Loading State Skeleton */}
                {activeTab === 'schemaExtractor' && schemaLoading && (
                  <motion.div
                    key="schema-loading-skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 w-full"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
                      <div className="h-8 w-24 bg-slate-200 rounded-md animate-pulse" />
                    </div>
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 animate-pulse">
                          <div className="h-4 w-32 bg-slate-200 rounded" />
                          <div className="h-3 w-full bg-slate-200 rounded" />
                          <div className="h-3 w-5/6 bg-slate-200 rounded" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Schema Extractor Success Dashboard */}
                {activeTab === 'schemaExtractor' && fetchedSchemas.length > 0 && !schemaLoading && (
                  <motion.div
                    key="schema-extractor-results"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6 w-full"
                  >
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-5 flex items-center justify-between bg-gradient-to-r from-indigo-50/20 to-transparent">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-semibold tracking-wider uppercase">تم استخراج السكيمة بنجاح</span>
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{fetchedSchemas.length} سكيمات مكتشفة</span>
                        </div>
                        <h3 className="font-mono text-xs font-semibold text-slate-700 truncate max-w-[280px] sm:max-w-md mt-1.5" dir="ltr" title={schemaUrl}>
                          {schemaUrl}
                        </h3>
                      </div>
                      <button
                        onClick={() => {
                          const combined = fetchedSchemas.map(s => s.rawData);
                          const blob = new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' });
                          const link = document.createElement('a');
                          link.href = URL.createObjectURL(blob);
                          link.setAttribute('download', 'extracted_schemas.json');
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        تنزيل الكل (JSON)
                      </button>
                    </div>

                    {/* Schema Selection Tabs */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">السكيمات المكتشفة بالصفحة:</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSchemaIndex('all')}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                            selectedSchemaIndex === 'all'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>كل السكيمات</span>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold font-mono ${
                            selectedSchemaIndex === 'all' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {fetchedSchemas.length}
                          </span>
                        </button>
                        {fetchedSchemas.map((schema, index) => {
                          const hasMissing = schema.missingFieldsCount > 0;
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setSelectedSchemaIndex(index)}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 cursor-pointer ${
                                selectedSchemaIndex === index
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span className="font-mono text-[10px] opacity-70">#{index + 1}</span>
                              <span>{schema.type}</span>
                              <span className={`w-2 h-2 rounded-full ${hasMissing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-6">
                      {fetchedSchemas
                        .map((schema, index) => ({ schema, index }))
                        .filter(({ index }) => selectedSchemaIndex === 'all' || selectedSchemaIndex === index)
                        .map(({ schema, index }) => (
                          <div key={index} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            {/* Card Header */}
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <span>كائن السكيمة:</span>
                                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-full font-mono text-xs font-bold">
                                      {schema.type}
                                    </span>
                                  </h4>
                                </div>
                              </div>

                              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                schema.missingFieldsCount === 0 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {schema.missingFieldsCount === 0 
                                  ? 'مكتملة بالكامل ✓'
                                  : `ناقصة (${schema.missingFieldsCount} حقول موصى بها)`}
                              </span>
                            </div>

                            {/* Card Content Tabs/Layout */}
                            <div className="p-5 space-y-6">
                              {/* Completeness Report section */}
                              <div>
                                <h5 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">تقرير جودة واكتمال الحقول الفنية:</h5>
                                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-right text-xs min-w-[500px]">
                                      <thead>
                                        <tr className="border-b border-slate-200/60 text-slate-500 font-semibold bg-slate-100/50">
                                          <th className="py-2.5 px-3">اسم الحقل</th>
                                          <th className="py-2.5 px-3">حالة الحقل</th>
                                          <th className="py-2.5 px-3">القيمة المستخرجة</th>
                                          <th className="py-2.5 px-3">التفاصيل والأهمية</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100/60 text-slate-700 bg-white">
                                        {schema.completenessCheck.map((check, cIdx) => (
                                          <tr key={cIdx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-3 font-mono font-semibold text-slate-800">{check.field}</td>
                                            <td className="py-3 px-3">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                check.status === 'good' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                check.status === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                'bg-amber-50 text-amber-700 border-amber-100'
                                              }`}>
                                                {check.status === 'good' ? 'موجود' : check.status === 'critical' ? 'مفقود (هام جداً)' : 'موصى به'}
                                              </span>
                                            </td>
                                            <td className="py-3 px-3">
                                              {check.value ? (
                                                <span className="font-mono text-slate-600 truncate block max-w-[200px]" title={check.value}>{check.value}</span>
                                              ) : (
                                                <span className="text-rose-400 italic">فارغ</span>
                                              )}
                                            </td>
                                            <td className="py-3 px-3 text-slate-500 text-[11px] leading-relaxed">{check.description}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* Raw JSON Code view */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">كود السكيمة المصدري (JSON-LD):</h5>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(JSON.stringify(schema.rawData, null, 2), index)}
                                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer"
                                  >
                                    {copiedFileIndex === index ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        تم النسخ!
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        نسخ السكيمة
                                      </>
                                    )}
                                  </button>
                                </div>
                                <pre className="p-4 bg-slate-950 text-slate-100 rounded-xl overflow-x-auto text-xs font-mono max-h-72 border border-slate-800" dir="ltr">
                                  {JSON.stringify(schema.rawData, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}

                {/* Empty State before search */}
                {!report && !loading && activeTab !== 'schemaExtractor' && (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 border-dashed rounded-2xl min-h-[300px] shadow-sm w-full"
                  >
                    <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 mb-4 shadow-sm">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">في انتظار بدء التحليل المباشر</h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-2 leading-relaxed">
                      أدخل الرابط أو كود HTML واضغط على زر التحليل للاستماع لبيانات السكيمة والهيكلة وتقرير السيو.
                    </p>
                  </motion.div>
                )}

                {/* Loading State Skeleton */}
                {!report && loading && activeTab !== 'schemaExtractor' && (
                  <motion.div
                    key="loading-skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
                      <div className="h-8 w-24 bg-slate-200 rounded-md animate-pulse" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 animate-pulse">
                          <div className="h-3 w-16 bg-slate-200 rounded" />
                          <div className="h-6 w-24 bg-slate-200 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                      <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse" />
                      <div className="h-4 w-4/6 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </motion.div>
                )}

                {/* Report Visual Display Dashboard */}
                {report && report.success && !loading && (
                  <motion.div
                    key="report-dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col"
                  >
                    {/* Report Header Info bar */}
                    <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-semibold tracking-wider uppercase">موقع تم تحليله</span>
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{report.timestamp.substring(11, 19)} UTC</span>
                        </div>
                        <h3 className="font-mono text-xs font-semibold text-slate-700 truncate max-w-[320px] sm:max-w-md mt-1" dir="ltr" title={report.url}>
                          {report.url}
                        </h3>
                      </div>
                      <button
                        onClick={() => {
                          let textReport = `★ تقرير فحص السيو والسكيمة لـ: ${report.url} ★\n\n`;
                          textReport += `1. مجموع الكلمات: ${report.wordCount}\n`;
                          textReport += `2. نوع السكيمة: ${report.schema ? report.schema.type : 'غير متوفر'}\n`;
                          textReport += `3. نتيجة السيو الإجمالية: ${report.seoAudit.score}/100\n`;
                          textReport += `4. عنوان الصفحة: ${report.seoAudit.title}\n`;
                          if (report.keywordAnalysis) {
                            textReport += `5. الكلمة المفتاحية: ${report.keywordAnalysis.keyword} (${report.keywordAnalysis.count} تكرارات - الكثافة: ${report.keywordAnalysis.density.toFixed(2)}%)\n`;
                          }
                          navigator.clipboard.writeText(textReport);
                          setCopiedText(true);
                          setTimeout(() => setCopiedText(false), 2000);
                        }}
                        className="self-start sm:self-center flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-all border border-slate-200 cursor-pointer"
                      >
                        {copiedText ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ التقرير</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Bento Box Summary Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 bg-slate-50/20">
                      {/* SEO Score Card */}
                      <div className="p-4 border-l border-b sm:border-b-0 border-slate-200 flex flex-col justify-between bg-white">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">نتيجة السيو (SEO)</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className={`text-2xl font-black ${
                            report.seoAudit.score >= 80 ? 'text-emerald-600' :
                            report.seoAudit.score >= 50 ? 'text-amber-600' : 'text-rose-600'
                          }`}>{report.seoAudit.score}</span>
                          <span className="text-slate-400 text-xs">/100</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                          {report.seoAudit.score >= 80 ? 'بنية ممتازة' : 'يحتاج تحسينات'}
                        </span>
                      </div>

                      {/* Word Count Card */}
                      <div className="p-4 border-l border-b sm:border-b-0 border-slate-200 flex flex-col justify-between bg-white">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">مجموع الكلمات</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl font-black text-slate-800">{report.wordCount}</span>
                          <span className="text-slate-400 text-[10px]">كلمة</span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 font-semibold">محتوى نصي أساسي</span>
                      </div>

                      {/* Schema Type Card */}
                      <div className="p-4 border-l border-slate-200 flex flex-col justify-between bg-white">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">سكيمة JSON-LD</span>
                        <div className="mt-1">
                          {report.schema ? (
                            <span className="text-xs font-bold text-indigo-600 font-mono truncate block max-w-full">
                              {report.schema.type}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-600">غير متوفرة</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                          {report.schema ? 'تم رصد الكود' : 'الظهور غائب'}
                        </span>
                      </div>

                      {/* Keyword Density Card */}
                      <div className="p-4 flex flex-col justify-between bg-white">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">كثافة الكلمة</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          {report.keywordAnalysis ? (
                            <>
                              <span className={`text-2xl font-black ${
                                report.keywordAnalysis.status === 'good' ? 'text-emerald-600' :
                                report.keywordAnalysis.status === 'stuffed' ? 'text-rose-600' : 'text-amber-600'
                              }`}>{report.keywordAnalysis.density.toFixed(1)}%</span>
                              <span className="text-[10px] text-slate-500">({report.keywordAnalysis.count}x)</span>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">لم تحدد</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                          {report.keywordAnalysis ? `حالة: ${report.keywordAnalysis.status === 'good' ? 'مثالية' : 'تحتاج ضبط'}` : 'لم يتم البحث'}
                        </span>
                      </div>
                    </div>

                    {/* Sub-tabs inside results */}
                    <div className="flex border-b border-slate-200 bg-slate-50 text-xs overflow-x-auto">
                      {[
                        { id: 'seo', label: 'فحص SEO تفصيلي' },
                        { id: 'schema', label: 'تفاصيل Schema المكتشفة' },
                        { id: 'keywords', label: 'أكثر الكلمات استعمالاً' },
                        { id: 'rawText', label: 'النص المصفى المستخلص' }
                      ].map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setResultsSubTab(subTab.id as any)}
                          className={`px-4 py-3 font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                            resultsSubTab === subTab.id
                              ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm'
                              : 'border-transparent text-slate-500 hover:text-slate-950 hover:bg-slate-100/50'
                          }`}
                        >
                          {subTab.label}
                        </button>
                      ))}
                    </div>

                    {/* Sub-tab views contents */}
                    <div className="p-5 flex-1 max-h-[500px] overflow-y-auto">
                      
                      {/* SEO Audit View */}
                      {resultsSubTab === 'seo' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2 uppercase tracking-wider">تفاصيل الفحص والتحسينات الموصى بها</h4>
                          <div className="space-y-3">
                            {report.seoAudit.checks.map((check, idx) => {
                              const StatusIcon = check.status === 'good' ? CheckCircle2 : check.status === 'warning' ? AlertTriangle : XCircle;
                              return (
                                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <StatusIcon className={`w-4 h-4 shrink-0 ${
                                        check.status === 'good' ? 'text-emerald-600' :
                                        check.status === 'warning' ? 'text-amber-600' : 'text-rose-600'
                                      }`} />
                                      <span className="text-xs font-bold text-slate-800">{check.name}</span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                      check.status === 'good' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                      check.status === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                    }`}>{check.value}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 font-normal leading-relaxed">{check.message}</p>
                                  <div className="bg-white p-2.5 border-r-2 border-indigo-500 rounded text-[11px] text-slate-500 shadow-sm">
                                    <span className="font-bold text-indigo-600">التوصية:</span> {check.recommendation}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Readability Score card */}
                          {report.readability && (
                            <div className="mt-6 pt-6 border-t border-slate-200">
                              <div className="flex items-center gap-2 mb-4">
                                <FileText className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">تحليل سهولة المقروئية (Flesch-Kincaid)</h4>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Ease Card */}
                                <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">مقياس سهولة القراءة (Flesch Reading Ease)</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                      <span className="text-3xl font-black text-indigo-600 font-mono">{report.readability.readingEase}</span>
                                      <span className="text-slate-400 text-xs font-medium">/ 100</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 mt-2">{report.readability.easeLabel}</p>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{report.readability.easeDescription}</p>
                                  </div>
                                  
                                  {/* Progress bar visual */}
                                  <div className="mt-4">
                                    <div className="bg-slate-200 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all ${
                                          report.readability.readingEase >= 80 ? 'bg-emerald-500' :
                                          report.readability.readingEase >= 60 ? 'bg-indigo-500' :
                                          report.readability.readingEase >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${report.readability.readingEase}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Grade Level Card */}
                                <div className="md:col-span-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">المستوى التعليمي للنص (Flesch-Kincaid Grade Level)</span>
                                    <div className="flex items-baseline gap-2 mt-1">
                                      <span className="text-3xl font-black text-indigo-600 font-mono">{report.readability.gradeLevel}</span>
                                      <span className="text-slate-400 text-xs font-medium">مستوى الصف</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-800 mt-2">{report.readability.gradeLabel}</p>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                      مؤشر يعكس عدد سنوات التعليم المدرسي اللازمة لفهم المفردات والجمل المكتوبة بالصفحة بشكل طبيعي.
                                    </p>
                                  </div>

                                  {/* Detailed counts */}
                                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200/60 text-center">
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-bold">الكلمات</p>
                                      <p className="text-xs font-bold text-slate-700 font-mono">{report.readability.wordsCount}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-bold">الجمل</p>
                                      <p className="text-xs font-bold text-slate-700 font-mono">{report.readability.sentencesCount}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-slate-400 font-bold">المقاطع الصوتية</p>
                                      <p className="text-xs font-bold text-slate-700 font-mono">{report.readability.syllablesCount}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* H1 / H2 Accordion */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                            <div>
                              <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">عناوين H1 ({report.seoAudit.h1Count})</h5>
                              {report.seoAudit.h1s.length > 0 ? (
                                <ul className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-32 overflow-y-auto">
                                  {report.seoAudit.h1s.map((h, i) => (
                                    <li key={i} className="text-[11px] text-slate-600 font-semibold list-disc list-inside truncate">{h}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[11px] text-slate-400 block italic">لا يوجد وسم H1</span>
                              )}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">عناوين H2 ({report.seoAudit.h2Count})</h5>
                              {report.seoAudit.h2s.length > 0 ? (
                                <ul className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 max-h-32 overflow-y-auto">
                                  {report.seoAudit.h2s.map((h, i) => (
                                    <li key={i} className="text-[11px] text-slate-600 font-semibold list-disc list-inside truncate">{h}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[11px] text-slate-400 block italic">لا توجد وسوم H2</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Schema View */}
                      {resultsSubTab === 'schema' && (
                        <div className="space-y-4">
                          {report.schema ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-800">التحقق من اكتمال حقول Schema ({report.schema.type})</h4>
                                <span className="text-[10px] text-slate-400 font-semibold">الحقول المفقودة: {report.schema.missingFieldsCount}</span>
                              </div>

                              <div className="space-y-2">
                                {report.schema.completenessCheck.map((check, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs shadow-sm">
                                    <div className="flex items-center gap-2">
                                      {check.exists ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <AlertTriangle className={`w-3.5 h-3.5 ${check.status === 'critical' ? 'text-rose-600' : 'text-amber-600'}`} />
                                      )}
                                      <span className="font-mono font-bold text-slate-800">{check.field}</span>
                                      <span className="text-[10px] text-slate-400 hidden sm:inline">({check.description})</span>
                                    </div>
                                    <span className={`text-[10px] truncate max-w-[150px] font-mono ${check.exists ? 'text-slate-600 font-semibold' : 'text-slate-400 italic'}`}>
                                      {check.exists ? check.value : 'مفقود'}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Raw JSON viewer */}
                              <div>
                                <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">كود Schema JSON-LD الخام المكتشف</h5>
                                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto text-left shadow-md" dir="ltr">
                                  <pre className="text-[10px] font-mono text-indigo-400 leading-normal whitespace-pre">
                                    {JSON.stringify(report.schema.rawData, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                              <h4 className="text-xs font-bold text-slate-800">لم نكتشف أي كود Schema JSON-LD</h4>
                              <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                                تفتقر هذه الصفحة إلى أكواد البيانات المنظمة. إضافة السكيمة تزيد فرص ظهور موقعك كـ Rich Snippet.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Keywords density list */}
                      {resultsSubTab === 'keywords' && (
                        <div className="space-y-4">
                          {/* Keyword density gauge */}
                          {report.keywordAnalysis && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-sm">
                              <h5 className="text-xs font-bold text-slate-800">تقييم كثافة الكلمة المستهدفة: "{report.keywordAnalysis.keyword}"</h5>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-slate-200 h-3.5 rounded-full overflow-hidden relative border border-slate-300">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      report.keywordAnalysis.status === 'good' ? 'bg-emerald-600' :
                                      report.keywordAnalysis.status === 'stuffed' ? 'bg-rose-600' : 'bg-amber-600'
                                    }`}
                                    style={{ width: `${Math.min(100, (report.keywordAnalysis.density / 3.5) * 100)}%` }}
                                  />
                                  {/* safe threshold helper zone markers */}
                                  <div className="absolute left-[14%] top-0 bottom-0 w-0.5 bg-slate-400" title="البداية الآمنة 0.5%" />
                                  <div className="absolute left-[71%] top-0 bottom-0 w-0.5 bg-slate-400" title="الحد الأقصى الآمن 2.5%" />
                                </div>
                                <span className="text-xs font-bold font-mono text-slate-800">{report.keywordAnalysis.density.toFixed(2)}%</span>
                              </div>
                              <p className="text-xs text-slate-600 font-normal leading-relaxed">{report.keywordAnalysis.recommendation}</p>
                            </div>
                          )}

                          <div>
                            <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">أكثر الكلمات استعمالاً بالصفحة (Top Keywords)</h4>
                            <p className="text-[10px] text-slate-400 mb-2 font-semibold">قمنا بحذف الحروف وجزيئات التوقف الشائعة (Stop Words) لعرض الكلمات الأكثر تأثيراً في النص.</p>
                            
                            <div className="space-y-1.5">
                              {report.topKeywords.map((top, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs shadow-sm">
                                  <div className="flex items-center gap-3">
                                    <span className="w-5 text-[10px] font-mono text-slate-400 font-bold">{idx + 1}.</span>
                                    <span className="font-bold text-slate-700">{top.word}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-[11px]">
                                    <span className="text-slate-500 font-medium">تكررت: <strong className="text-slate-800">{top.count} مرات</strong></span>
                                    <span className="font-mono text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">{top.density.toFixed(2)}%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Clean Text View */}
                      {resultsSubTab === 'rawText' && (
                        <div className="space-y-2 text-right">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">مقتطف من المحتوى النصي المستخلص (أول 1000 حرف)</h4>
                          <p className="text-[10px] text-slate-400 mb-2 font-semibold">هذا النص يمثل جوهر الصفحة الذي تم تحليله بعد تصفية عناصر التصفح وقوائم الهيدر والفوتر والإعلانات تماماً.</p>
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto shadow-sm">
                            <p className="text-xs text-slate-600 font-normal leading-relaxed whitespace-pre-wrap">{report.extractedText}</p>
                          </div>
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

      </main>

      <footer className="border-t border-slate-200 mt-20 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-right">
            <p className="text-xs text-slate-700 font-bold">مستخرج السكيمة وفاحص السيو المتقدم</p>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Built with React, Express, and Cheerio in AI Studio</p>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            &copy; 2026 AI Studio. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
