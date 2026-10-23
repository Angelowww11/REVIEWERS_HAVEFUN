from summative3_teaching_notes import apply_teaching_notes
"""Import the nine saved Canvas reviews without executing their contents."""
from pathlib import Path
from email import policy
from email.parser import BytesParser
from bs4 import BeautifulSoup
from urllib.parse import urljoin, unquote
from urllib.request import urlopen
import collections
import hashlib
import json
import re
import unicodedata
from summative3_review_notes import annotate_conflicts, write_summary, apply_supplement

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'QUESTION POOLS'
FILES = ['Q1.mhtml', 'Q3.mhtml', 'Q4.mhtml', 'Q5.mhtml', 'Q6.mhtml', 'Q7.mhtml', 'Q8.mhtml', 'Q9.mhtml', 'Seatwork 3_ 1TSY2627_IT0015_TC33_TX33-17.mhtml']

def text(node):
    return re.sub(r'\s+', ' ', node.get_text(' ', strip=True).replace('\u200b', '').replace('\u00ad', '')).strip() if node else ''

def normal(value):
    value = unicodedata.normalize('NFKC', value).translate(str.maketrans({'’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-'}))
    return re.sub(r'[.?!]+$', '', re.sub(r'\s+', ' ', value.casefold()).strip()).strip()

questions, notes, seen, stems = [], {}, {}, collections.defaultdict(list)
audit = {'sources': [], 'duplicates': [], 'answerConflicts': [], 'missingAnswers': [], 'missingAssets': [], 'incompleteCaptures': [], 'ignoredRegions': []}
assets = ROOT / 'exhibits' / 'summative3'
assets.mkdir(parents=True, exist_ok=True)
asset_map_path = ROOT / 'summative3-asset-map.json'
asset_map = json.loads(asset_map_path.read_text(encoding='utf-8')) if asset_map_path.exists() else {}
for filename in FILES:
    message = BytesParser(policy=policy.default).parsebytes((SOURCE / filename).read_bytes())
    parts = list(message.walk())
    document = next(p for p in parts if p.get_content_type() == 'text/html')
    html = document.get_payload(decode=True).decode(document.get_content_charset() or 'utf-8', errors='replace')
    soup = BeautifulSoup(html, 'html.parser')
    base = document.get('Content-Location', '')
    resources = {}
    for part in parts:
        if part.get_content_type().startswith('image/'):
            data = part.get_payload(decode=True)
            suffix = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/webp': '.webp'}.get(part.get_content_type(), '.img')
            name = hashlib.sha256(data).hexdigest()[:24] + suffix
            location = part.get('Content-Location', '')
            resources[unquote(location)] = (name, data)
            cid = part.get('Content-ID', '').strip('<>')
            if cid:
                resources['cid:' + cid] = (name, data)
    regions = soup.select('[role="region"][aria-label="Question"]')
    imported = 0
    for position, region in enumerate(regions, 1):
        prompt = region.select_one('.question_text')
        kind = text(region.select_one('.question_type'))
        if not prompt or not kind:
            audit['ignoredRegions'].append({'file': filename, 'position': position, 'reason': 'No question content/type in the saved region'})
            continue
        fragment = BeautifulSoup(str(prompt), 'html.parser')
        for unwanted in fragment.select('script, style, iframe, object, embed, form, input, textarea, button'):
            unwanted.decompose()
        image_keys = []
        for image in fragment.select('img'):
            src = image.get('src', '')
            resource = resources.get(unquote(urljoin(base, src))) or resources.get(unquote(src))
            asset_key = hashlib.sha256(unquote(urljoin(base, src)).split('?')[0].encode()).hexdigest()
            cached = asset_map.get(asset_key)
            if not resource and cached and (assets / cached).exists():
                resource = (cached, (assets / cached).read_bytes())
            if not resource:
                try:
                    with urlopen(urljoin(base, src), timeout=25) as response:
                        mime = response.headers.get_content_type()
                        if not mime.startswith('image/'):
                            raise ValueError('The source attachment is not an image')
                        data = response.read(10 * 1024 * 1024 + 1)
                        if len(data) > 10 * 1024 * 1024:
                            raise ValueError('Exhibit exceeds the import limit')
                    suffix = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/webp': '.webp'}.get(mime, '.img')
                    resource = (hashlib.sha256(data).hexdigest()[:24] + suffix, data)
                except Exception:
                    resource = None
            if resource:
                name, data = resource
                (assets / name).write_bytes(data)
                asset_map[asset_key] = name
                image['src'] = 'exhibits/summative3/' + name
                image_keys.append(name)
            else:
                audit['missingAssets'].append({'file': filename, 'question': position, 'url': src.split('?')[0]})
            image['alt'] = image.get('alt') or 'Question exhibit'
        for tag in fragment.find_all(True):
            tag.attrs = {k: v for k, v in tag.attrs.items() if k in ('src', 'alt', 'colspan', 'rowspan')}
        stem = text(prompt)
        if kind == 'true_false_question':
            stem = re.sub(r'\s+(?:true\s+false|false\s+true)\s*$', '', stem, flags=re.I)
        options, correct, explanations = [], [], []
        for answer in region.select('div.answer'):
            content = answer.select_one('.answer_text')
            value = text(content)
            if not value:
                field = answer.select_one('input.question_input[value]')
                value = field.get('value', '').strip() if field else ''
            if not value:
                continue
            options.append(value)
            if 'correct_answer' in answer.get('class', []):
                correct.append(value)
                explanation = text(answer.select_one('.answer_comment_html')) or text(answer.select_one('.answer_comment'))
                if explanation:
                    explanations.append(explanation)
        if not stem or len(options) < 2 or not correct:
            audit['incompleteCaptures'].append({'file': filename, 'question': position, 'text': stem, 'type': kind, 'options': options})
            continue
        key = (normal(stem), tuple(sorted(normal(o) for o in options)), tuple(sorted(image_keys)), tuple(sorted(normal(a) for a in correct)))
        provenance = {'sourceFile': filename, 'sourceQuestionId': text(region.select_one('.assessment_question_id')), 'position': position}
        if key in seen:
            kept = seen[key]
            kept['sources'].append(provenance)
            audit['duplicates'].append({'source': provenance, 'keptId': kept['id']})
            continue
        item = {'id': len(questions) + 1, 'sourceFile': 'Summative 3 · ' + ('Seatwork 3' if filename.startswith('Seatwork') else filename.removesuffix('.mhtml')), 'type': kind, 'question': stem, 'questionHtml': ''.join(str(child) for child in fragment.find().contents), 'options': options, 'correctAnswers': correct, 'sources': [provenance]}
        questions.append(item)
        seen[key] = item
        stems[normal(stem)].append(item)
        notes[str(item['id'])] = '\n'.join(dict.fromkeys(explanations)) or ('Source answer: ' + ' · '.join(correct) + '. Revisit the conditions in the question and compare each choice with this answer.')
        imported += 1
    audit['sources'].append({'file': filename, 'questionRegions': len(regions), 'uniqueAdded': imported})
for capture in audit['incompleteCaptures']:
    matches = stems.get(normal(capture['text']), [])
    capture['recoveredIds'] = [q['id'] for q in matches if all(normal(option) in list(map(normal, q['options'])) for option in capture['options'])]
    if not capture['recoveredIds']:
        audit['missingAnswers'].append(capture)
for group in stems.values():
    if len(group) > 1:
        for left in group:
            for right in group:
                if left['id'] < right['id'] and sorted(map(normal, left['options'])) == sorted(map(normal, right['options'])) and sorted(map(normal, left['correctAnswers'])) != sorted(map(normal, right['correctAnswers'])):
                    audit['answerConflicts'].append([left['id'], right['id']])
audit['questionCount'] = len(questions)
audit['sourceQuestionCount'] = sum(s['questionRegions'] for s in audit['sources'])
audit['variantGroups'] = [[q['id'] for q in group] for group in stems.values() if len(group) > 1]
(ROOT / 'summative3-import-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
asset_map_path.write_text(json.dumps(asset_map, indent=2) + '\n', encoding='utf-8')
if audit['missingAnswers'] or audit['missingAssets']:
    raise ValueError('Import needs review; see summative3-import-audit.json')
annotate_conflicts(questions, notes, audit)
write_summary(audit)
data = {'title': 'Summative 3 Networking Review', 'sourceFiles': list(FILES), 'questionCount': len(questions), 'questions': questions}
apply_supplement(data, notes)
apply_teaching_notes(notes)
(ROOT / 'summative3-questions.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(ROOT / 'summative3-explanations.json').write_text(json.dumps(notes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in audit.items() if k not in ('duplicates', 'variantGroups')}, ensure_ascii=False, indent=2))
