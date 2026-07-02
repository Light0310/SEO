export interface PythonFile {
  name: string;
  description: string;
  code: string;
}

export const PYTHON_SCRIPTS: PythonFile[] = [
  {
    name: "main.py",
    description: "نقطة التشغيل الرئيسية (Main Entry Point) التي تدير تدفق تحليل السيو والسكيمة بالكامل.",
    code: `import sys
from fetcher import fetch_html
from schema_extractor import extract_schemas, analyze_schema_completeness
from content_extractor import extract_main_text, count_words
from keyword_analyzer import analyze_keyword_density, get_top_keywords
from report_generator import generate_terminal_report, export_to_csv
from bs4 import BeautifulSoup

def run_seo_pipeline(url: str, keyword: str = "") -> dict:
    """
    Main coordination function to run the entire analysis pipeline:
    URL -> Download HTML -> Extract Schema -> Extract Main Content -> Count Words -> Analyze Keyword -> SEO Checks -> Report
    """
    print(f"[*] Fetching HTML content for: {url}")
    html = fetch_html(url)
    
    print("[*] Extracting main content text (excluding scripts, styles, headers, footers)...")
    text = extract_main_text(html)
    word_cnt = count_words(text)
    
    print("[*] Extracting structured schemas (JSON-LD)...")
    schemas = extract_schemas(html)
    schema_analysis = None
    if schemas:
        # Pick the most relevant core schema (Article, Product, LocalBusiness)
        primary = None
        for s in schemas:
            stype = s.get('@type', '').lower()
            if any(t in stype for t in ['article', 'blogposting', 'newsarticle', 'product', 'localbusiness']):
                primary = s
                break
        if not primary:
            primary = schemas[0]
            
        schema_analysis = analyze_schema_completeness(primary.get('@type', 'Thing'), primary)

    print("[*] Performing Keyword analysis & density calculation...")
    kw_analysis = None
    if keyword:
        kw_analysis = analyze_keyword_density(text, keyword, word_cnt)
        
    top_kws = get_top_keywords(text, word_cnt)
    
    print("[*] Executing basic SEO Audit checks...")
    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Title Tag
    title = soup.title.string.strip() if soup.title else ""
    
    # 2. Meta Description
    meta_desc = ""
    desc_tag = soup.find('meta', attrs={'name': 'description'})
    if desc_tag and desc_tag.get('content'):
        meta_desc = desc_tag.get('content').strip()
        
    # 3. Headings
    h1s = [h1.get_text().strip() for h1 in soup.find_all('h1') if h1.get_text()]
    h2s = [h2.get_text().strip() for h2 in soup.find_all('h2') if h2.get_text()]
    
    # 4. Images & Alt
    images = soup.find_all('img')
    total_images = len(images)
    images_with_alt = len([img for img in images if img.get('alt') and img.get('alt').strip()])
    
    # Calculate score out of 100
    score = 100
    if not title: score -= 20
    elif len(title) < 40 or len(title) > 65: score -= 5
    
    if not meta_desc: score -= 20
    elif len(meta_desc) < 100 or len(meta_desc) > 165: score -= 5
    
    if len(h1s) == 0: score -= 15
    elif len(h1s) > 1: score -= 8
    
    if len(h2s) == 0: score -= 5
    
    if total_images > 0:
        alt_pct = (images_with_alt / total_images) * 100
        if alt_pct < 50: score -= 10
        elif alt_pct < 100: score -= 5
        
    if not schema_analysis: score -= 10
    score = max(10, min(100, score))
    
    report = {
        "url": url,
        "word_count": word_cnt,
        "schema": schema_analysis,
        "keyword_analysis": kw_analysis,
        "top_keywords": top_kws,
        "seo_audit": {
            "title": title,
            "title_length": len(title),
            "meta_description": meta_desc,
            "meta_description_length": len(meta_desc),
            "h1_count": len(h1s),
            "h2_count": len(h2s),
            "total_images": total_images,
            "images_with_alt": images_with_alt,
            "score": score
        }
    }
    return report

if __name__ == "__main__":
    print("=" * 60)
    print("    SEO & Schema JSON-LD Extractor Pipeline")
    print("=" * 60)
    
    url_input = input("Enter Website URL (e.g. https://example.com): ").strip()
    if not url_input:
        print("[✗] Error: Please enter a valid URL.")
        sys.exit(1)
        
    if not url_input.startswith("http"):
        url_input = "https://" + url_input
        
    keyword_input = input("Enter Target Keyword to analyze density (Optional): ").strip()
    
    try:
        report = run_seo_pipeline(url_input, keyword_input)
        generate_terminal_report(report)
        
        export_q = input("\\nDo you want to export report to CSV? (y/n): ").strip().lower()
        if export_q == 'y':
            export_to_csv(report)
            
    except Exception as e:
        print(f"\\n[✗] An error occurred: {str(e)}")
`
  },
  {
    name: "fetcher.py",
    description: "يقوم بجلب كود HTML الخاص بالرابط المدخل باستعمال مكتبة urllib القياسية وتفادي الحظر.",
    code: `import urllib.request
from urllib.error import URLError, HTTPError

def fetch_html(url: str) -> str:
    """
    Fetches HTML content from a given URL using python standard urllib.
    Uses custom User-Agent headers to avoid simple scraping blocks.
    """
    try:
        req = urllib.request.Request(
            url, 
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ExtractorBot/1.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode('utf-8', errors='ignore')
    except HTTPError as e:
        raise Exception(f"HTTP Error: {e.code} - {e.reason}")
    except URLError as e:
        raise Exception(f"URL Error: {e.reason}")
    except Exception as e:
        raise Exception(f"Unexpected Error: {str(e)}")
`
  },
  {
    name: "schema_extractor.py",
    description: "يستخرج ويدمج بيانات Schema JSON-LD ويبحث عن الحقول الناقصة ونسبة اكتمال البيانات.",
    code: `import json
from typing import Dict, Any, List

def extract_schemas(html: str) -> List[Dict[str, Any]]:
    """
    Finds all script tags with type='application/ld+json' in the HTML,
    parses them and recursively flattens potential @graph nested lists.
    """
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    schemas = []
    
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            raw_text = script.string.strip() if script.string else ""
            if raw_text:
                data = json.loads(raw_text)
                schemas.extend(flatten_or_collect_schemas(data))
        except Exception:
            pass
    return schemas

def flatten_or_collect_schemas(data: Any) -> List[Dict[str, Any]]:
    """Recursively flattens lists or @graph arrays within JSON-LD."""
    collected = []
    if isinstance(data, list):
        for item in data:
            collected.extend(flatten_or_collect_schemas(item))
    elif isinstance(data, dict):
        if '@graph' in data:
            collected.extend(flatten_or_collect_schemas(data['@graph']))
        elif '@type' in data:
            collected.append(data)
            # Search child fields too for nested schemas
            for k, v in data.items():
                if isinstance(v, (dict, list)):
                    collected.extend(flatten_or_collect_schemas(v))
    return collected

def analyze_schema_completeness(schema_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Performs field checks based on schema type (Article, Product, LocalBusiness)
    and reports missing critical/warning attributes.
    """
    t = schema_type.lower()
    checks = []
    
    def check_field(path: List[str], label: str, level: str, desc: str):
        val = data
        for p in path:
            if isinstance(val, dict) and p in val:
                val = val[p]
            else:
                val = None
                break
        exists = val is not None and str(val).strip() != ""
        status = "good" if exists else ("critical" if level == "critical" else "warning")
        checks.append({
            "field": label,
            "exists": exists,
            "value": str(val) if exists else None,
            "status": status,
            "description": desc
        })

    if any(k in t for k in ['article', 'blogposting', 'newsarticle']):
        check_field(['headline'], 'headline', 'critical', 'العنوان الرئيسي للمقال')
        check_field(['author'], 'author', 'critical', 'اسم كاتب أو ناشر المقال')
        check_field(['datePublished'], 'datePublished', 'critical', 'تاريخ النشر الأصلي')
        check_field(['description'], 'description', 'warning', 'موجز أو ملخص قصير للمقال')
        check_field(['publisher'], 'publisher', 'warning', 'الجهة الناشرة للمقال شعارها واسمها')
        check_field(['image'], 'image', 'warning', 'رابط صورة بارزة مرافقة للمقال')
    elif 'product' in t:
        check_field(['name'], 'name', 'critical', 'اسم المنتج التجاري')
        check_field(['brand'], 'brand', 'warning', 'الشركة المصنعة أو العلامة التجارية')
        check_field(['offers', 'price'], 'price', 'critical', 'سعر المنتج الحالي')
        check_field(['offers', 'priceCurrency'], 'priceCurrency', 'critical', 'عملة البيع (مثال: MAD, USD)')
        check_field(['aggregateRating', 'ratingValue'], 'ratingValue', 'warning', 'متوسط تقييم المشترين للمنتج')
        check_field(['image'], 'image', 'warning', 'صور عالية الدقة للمنتج')
    elif any(k in t for k in ['localbusiness', 'restaurant', 'store', 'organization']):
        check_field(['name'], 'name', 'critical', 'الاسم التجاري للمؤسسة')
        check_field(['address'], 'address', 'critical', 'العنوان الجغرافي الفعلي للمحل')
        check_field(['telephone'], 'telephone', 'critical', 'رقم الهاتف للتواصل المباشر')
        check_field(['openingHours'], 'openingHours', 'warning', 'ساعات العمل الرسمية')
        check_field(['geo'], 'geo', 'warning', 'الإحداثيات الجغرافية لموقع المحل')
    else:
        check_field(['name'], 'name', 'critical', 'اسم العنصر أو الكيان الهيكلي')
        check_field(['description'], 'description', 'warning', 'الوصف التفصيلي للعنصر')

    return {
        "type": schema_type,
        "checks": checks,
        "missing_count": len([c for c in checks if c['status'] != 'good'])
    }
`
  },
  {
    name: "content_extractor.py",
    description: "يقوم باستخلاص النصوص الحقيقية من صفحة الويب وحذف كود Javascript والعناصر المزعجة والإعلانات.",
    code: `import re

def extract_main_text(html: str) -> str:
    """
    Strips unnecessary tags (scripts, styles, headers, footers, navs)
    and extracts actual body text. Also filters out typical ad containers.
    """
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    
    # 1. Purge code blocks, navigational elements, and templates
    for el in soup(["script", "style", "header", "footer", "nav", "noscript", "iframe", "svg", "aside", "form"]):
        el.decompose()
        
    # 2. Purge common ad-related wrapper patterns using classes/ids
    ad_pattern = re.compile(r'ad-|ads-|social-share|newsletter-signup|sidebar-ad', re.I)
    for ad_el in soup.find_all(class_=ad_pattern):
        ad_el.decompose()
    for ad_el in soup.find_all(id=ad_pattern):
        ad_el.decompose()
        
    text = soup.get_text()
    
    # 3. Clean spacing and reduce to a simple contiguous text representation
    cleaned = re.sub(r'\\s+', ' ', text).strip()
    return cleaned

def count_words(text: str) -> int:
    """Calculates overall word count in the extracted string."""
    words = re.findall(r'\\w+', text)
    return len(words)
`
  },
  {
    name: "keyword_analyzer.py",
    description: "يقوم بحساب تكرار كلمة مفتاحية معينة وحساب الـ Keyword Density واستخراج الكلمات الأكثر تكراراً.",
    code: `import re
from collections import Counter
from typing import Dict, Any, List, Tuple

# Common Stopwords to ignore in both Arabic and English
STOP_WORDS = {
    'the', 'and', 'a', 'to', 'of', 'in', 'is', 'that', 'it', 'on', 'for', 'as', 'with', 'was', 'at', 'by', 'an', 'be', 'this', 'are', 'or', 'from', 'but', 'not',
    'من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'هذا', 'هذه', 'مع', 'أو', 'و', 'لا', 'ما', 'هو', 'هي', 'التي', 'الذي', 'كل', 'بعد', 'قبل', 'حتى', 'كان', 'تم', 'لقد'
}

def analyze_keyword_density(text: str, keyword: str, total_words: int) -> Dict[str, Any]:
    """
    Calculates exact occurrences of a target keyword, finds its density, 
    and checks if it sits in the ideal SEO range (0.5% - 2.5%).
    """
    if not keyword or total_words == 0:
        return {}
        
    kw = keyword.lower().strip()
    escaped_kw = re.escape(kw)
    
    # Check with standard word boundaries first
    pattern = re.compile(rf'\\b{escaped_kw}\\b', re.I)
    matches = pattern.findall(text)
    count = len(matches)
    
    # Substring search fallback for languages like Arabic where boundaries behave differently
    if count == 0 and kw in text.lower():
        count = text.lower().count(kw)
        
    density = (count / total_words) * 100
    
    if density < 0.5:
        status = "too-low"
        recommendation = f"كثافة منخفضة ({density:.2f}%). يُنصح بإضافة الكلمة للمقدمة والعناوين الفرعية."
    elif density > 2.5:
        status = "stuffed"
        recommendation = f"حشو كلمات مفرط ({density:.2f}%). قد تعتبره جوجل محاولة تلاعب. يُنصح بخفض التكرار."
    else:
        status = "good"
        recommendation = f"كثافة مثالية وسليمة تماماً ({density:.2f}%)."
        
    return {
        "keyword": keyword,
        "count": count,
        "density": density,
        "status": status,
        "recommendation": recommendation
    }

def get_top_keywords(text: str, total_words: int, top_n: int = 10) -> List[Tuple[str, int, float]]:
    """
    Finds the top N most frequent meaningful words, 
    purging stopwords and pure numbers.
    """
    words = re.findall(r'\\b\\w+\\b', text.lower())
    filtered = [
        w for w in words 
        if len(w) > 2 and w not in STOP_WORDS and not w.isdigit()
    ]
    
    counter = Counter(filtered)
    top_list = []
    
    for word, count in counter.most_common(top_n):
        density = (count / total_words) * 100 if total_words > 0 else 0
        top_list.append((word, count, density))
        
    return top_list
`
  },
  {
    name: "report_generator.py",
    description: "يقوم بصياغة تقرير منظم يعرض مخرجات السيو والسكيمة على الطرفية وتصديرها لـ CSV.",
    code: `import csv
from typing import Dict, Any

def generate_terminal_report(report: Dict[str, Any]) -> None:
    """
    Formats the analysis report object into a visually stunning,
    well-spaced CLI print layout.
    """
    print("\\n" + "=" * 65)
    print(f"      ★ SEO & SCHEMA EXTRACTION REPORT ★")
    print("=" * 65)
    print(f"[*] Target URL: {report['url']}")
    print(f"[*] Word Count: {report['word_count']} words")
    print("-" * 65)
    
    # 1. Schema Section
    if report.get('schema'):
        s = report['schema']
        print(f"\\n[+] SCHEMA FOUND: {s['type']}")
        print(f"    Missing Fields Count: {s['missing_count']}")
        for c in s['checks']:
            indicator = "[✓]" if c['exists'] else "[✗]"
            val = f"-> \\'{c['value']}\\'" if c['exists'] else "(MISSING)"
            print(f"    {indicator} {c['field']:<15} {val}")
    else:
        print("\\n[-] SCHEMA JSON-LD: Not Found inside this page.")
        
    # 2. Keyword Section
    if report.get('keyword_analysis'):
        ka = report['keyword_analysis']
        print(f"\\n[*] TARGET KEYWORD: \\'{ka['keyword']}\\'")
        print(f"    Occurrences   : {ka['count']} times")
        print(f"    Density       : {ka['density']:.2f}%")
        print(f"    Evaluation    : {ka['status'].upper()}")
        print(f"    Advice        : {ka['recommendation']}")
        
    # 3. Top Keywords
    print("\\n[+] TOP 5 MEANINGFUL WORDS FOUND:")
    for idx, (word, count, density) in enumerate(report.get('top_keywords', [])[:5], 1):
        print(f"    {idx}. \\'{word:<12}\\' : {count:<3} times ({density:.2f}%)")
        
    # 4. SEO Checks Section
    print("-" * 65)
    seo = report['seo_audit']
    print(f"[★] TOTAL SEO HEALTH SCORE: {seo['score']}/100")
    print("-" * 65)
    print(f"    • Title Tag  : \\'{seo['title']}\\' ({seo['title_length']} chars)")
    print(f"    • Meta Desc  : {seo['meta_description_length']} chars")
    print(f"    • H1 Count   : {seo['h1_count']}")
    print(f"    • H2 Count   : {seo['h2_count']}")
    print(f"    • Images Alt : {seo['images_with_alt']} of {seo['total_images']} have ALT set")
    print("=" * 65 + "\\n")

def export_to_csv(report: Dict[str, Any], filename: str = "seo_report.csv") -> None:
    """
    Exports the core analysis values and SEO score details 
    into a spreadsheet CSV file.
    """
    try:
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(["Metric Name", "Value Description"])
            writer.writerow(["Target Website", report["url"]])
            writer.writerow(["Word Count", f"{report['word_count']} words"])
            
            # Schema
            stype = report["schema"]["type"] if report.get("schema") else "None"
            smiss = report["schema"]["missing_count"] if report.get("schema") else "N/A"
            writer.writerow(["Schema Type Found", stype])
            writer.writerow(["Schema Missing Fields", smiss])
            
            # Keyword
            if report.get("keyword_analysis"):
                ka = report["keyword_analysis"]
                writer.writerow(["Analyzed Keyword", ka["keyword"]])
                writer.writerow(["Keyword Occurrences", ka["count"]])
                writer.writerow(["Keyword Density (%)", f"{ka['density']:.2f}%"])
                writer.writerow(["Keyword Status", ka["status"]])
                
            # SEO Audit
            seo = report["seo_audit"]
            writer.writerow(["SEO Overall Score", f"{seo['score']}/100"])
            writer.writerow(["Title Text", seo["title"]])
            writer.writerow(["Title Length", f"{seo['title_length']} chars"])
            writer.writerow(["H1 Headers Count", seo["h1_count"]])
            writer.writerow(["H2 Headers Count", seo["h2_count"]])
            writer.writerow(["Total Image Elements", seo["total_images"]])
            writer.writerow(["Images with ALT Tags", seo["images_with_alt"]])
            
        print(f"[✓] Report exported successfully to file: '{filename}'")
    except Exception as e:
        print(f"[✗] Failed to write CSV file: {str(e)}")
`
  }
];
