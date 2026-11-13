from pathlib import Path
from email import policy
from email.parser import BytesParser
from bs4 import BeautifulSoup
from urllib.parse import unquote, urljoin
import collections, hashlib, json, re, unicodedata

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
bank = json.loads((SITE / 'summative4-questions.json').read_text(encoding='utf-8'))
asset_map = json.loads((SITE / 'summative4-asset-map.json').read_text(encoding='utf-8'))
provenance = {}
for q in bank['questions']:
    for source in q['sources']:
        provenance[(source['sourceFile'], source['sourceQuestionId'], source['position'])] = q

def clean(value):
    value = unicodedata.normalize('NFKC', value).replace('\u200b', '').replace('\u00ad', '')
    value = value.translate(str.maketrans({'’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-'}))
    return re.sub(r'[.?!]+$', '', re.sub(r'\s+', ' ', value).strip().casefold()).strip()

def content(node):
    return node.get_text(' ', strip=True) if node else ''

def stem_text(value, kind):
    if kind == 'true_false_question':
        value = re.sub(r'\s+(?:true\s+false|false\s+true)\s*$', '', value, flags=re.I)
    return clean(value)

report = {'sources': [], 'missing': [], 'mismatches': [], 'incomplete': [], 'emptyTemplates': [], 'rawPromptDifferences': [], 'unsupportedChoices': [], 'sourceSelectedWrong': 0}
covered_ids = set()
for filename in bank['sourceFiles']:
    message = BytesParser(policy=policy.default).parsebytes((ROOT / 'SA3' / filename).read_bytes())
    part = next(p for p in message.walk() if p.get_content_type() == 'text/html')
    soup = BeautifulSoup(part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8'), 'html.parser')
    cards = soup.find_all('div', class_='display_question')
    regions = soup.find_all('div', attrs={'role': 'region', 'aria-label': 'Question'})
    all_prompts = soup.find_all('div', class_='question_text')
    counts = collections.Counter()
    for position, card in enumerate(cards, 1):
        prompt = card.find('div', class_='question_text')
        kind = content(card.find('span', class_='question_type'))
        stem = stem_text(content(prompt), kind)
        identity = content(card.find('span', class_='assessment_question_id'))
        options, correct, selected = [], [], []
        for answer in card.find_all('div', class_='answer'):
            label = answer.find('div', class_='answer_text')
            value = content(label)
            if not value:
                field = answer.find('input', class_='question_input', attrs={'value': True})
                value = field.get('value', '') if field else ''
            if not value:
                if label and label.find('img'):
                    report['unsupportedChoices'].append([filename, position, 'image-only choice'])
                continue
            options.append(clean(value))
            if 'correct_answer' in answer.get('class', []): correct.append(clean(value))
            if 'selected_answer' in answer.get('class', []): selected.append(clean(value))
        if kind == 'short_answer_question':
            options = []
            correct = list(set(correct))
        if selected and sorted(selected) != sorted(correct): report['sourceSelectedWrong'] += 1
        if not stem and not options:
            report['emptyTemplates'].append([filename, position]); counts['empty'] += 1; continue
        raw = card.find('textarea', attrs={'name': 'question_text'})
        if raw and stem_text(content(BeautifulSoup(raw.get_text(), 'html.parser')), kind) != stem:
            report['rawPromptDifferences'].append([filename, position])
        if not kind or (kind != 'short_answer_question' and len(options) < 2) or not correct:
            recovered = [q['id'] for q in bank['questions'] if stem_text(q['question'], q['type']) == stem and all(o in [clean(x) for x in q['options']] for o in options)]
            report['incomplete'].append({'file': filename, 'position': position, 'recoveredIds': recovered})
            counts['incomplete'] += 1
            if not recovered: report['missing'].append([filename, position, 'unrecovered partial question'])
            covered_ids.update(recovered)
            continue
        counts['complete'] += 1
        match = provenance.get((filename, identity, position))
        if not match:
            report['missing'].append([filename, position, identity]); continue
        covered_ids.add(match['id'])
        checks = {
            'stem': stem_text(match['question'], match['type']) == stem,
            'choices': sorted(clean(x) for x in match['options']) == sorted(options),
            'key': sorted(clean(x) for x in match['correctAnswers']) == sorted(correct),
        }
        expected_images = []
        for img in prompt.find_all('img') if prompt else []:
            canonical = unquote(urljoin(part.get('Content-Location', ''), img.get('src', ''))).split('?')[0]
            asset = asset_map.get(hashlib.sha256(canonical.encode()).hexdigest())
            expected_images.append('exhibits/summative4/' + asset if asset else 'MISSING')
        actual_images = re.findall(r'src="([^"]+)"', match['questionHtml'])
        checks['images'] = sorted(expected_images) == sorted(actual_images)
        if not all(checks.values()): report['mismatches'].append({'file': filename, 'position': position, 'deckId': match['id'], 'checks': checks})
    report['sources'].append({'file': filename, 'displayQuestions': len(cards), 'questionRegions': len(regions), 'allQuestionPrompts': len(all_prompts), **counts})
report['bankCount'] = len(bank['questions'])
report['coveredUniqueQuestions'] = len(covered_ids)
report['unreferencedBankIds'] = sorted({q['id'] for q in bank['questions']} - covered_ids)
(SITE / 'summative4-independent-coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in report.items()},indent=2))
assert not report['missing'] and not report['mismatches'] and not report['unreferencedBankIds']
