"""Bundle public study data and exhibits into a reproducible unpacked extension ZIP."""
import json
import re
import shutil
from pathlib import Path
from html.parser import HTMLParser
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent
EXT = ROOT / 'extension'

class Prompt(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text, self.images = [], []
    def handle_starttag(self, tag, attrs):
        if tag in ('p', 'br', 'div', 'li'): self.text.append('\n')
        if tag == 'img':
            src = dict(attrs).get('src', '')
            if re.fullmatch(r'exhibits/(?:[a-z0-9_-]+/)*[a-z0-9_.-]+\.(?:png|jpe?g|webp|gif|svg)', src, re.I): self.images.append(src)
    def handle_data(self, data): self.text.append(data)

def build():
    questions, exhibits = [], set()
    version = json.loads((EXT / 'manifest.json').read_text(encoding='utf-8'))['version']
    for deck, qfile, efile in [('pools','questions.json','explanations.json'),('ccst','ccst-questions.json','ccst-explanations.json'),('summative3','summative3-questions.json','summative3-explanations.json')]:
        data = json.loads((ROOT / qfile).read_text(encoding='utf-8'))
        explanations = json.loads((ROOT / efile).read_text(encoding='utf-8'))
        for q in data['questions']:
            prompt = Prompt(); prompt.feed(q.get('questionHtml', ''))
            text = '\n'.join(re.sub(r'\s+', ' ', line).strip() for line in ''.join(prompt.text).splitlines() if line.strip())
            questions.append({'id':q['id'],'deck':deck,'type':q['type'],'question':text or q['question'],'options':q.get('options',[]),'answers':q['correctAnswers'],'statements':q.get('statements',[]),'pairs':q.get('dragPairs',[]),'statementNotes':q.get('statementExplanations',[]),'explanation':explanations.get(str(q['id']),''),'images':list(dict.fromkeys(prompt.images))})
            exhibits.update(prompt.images)
    (EXT / 'bank-data.json').write_text(json.dumps({'version':version,'questions':questions},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    for path in sorted(exhibits):
        destination = EXT / path
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(ROOT / path,destination)
    from PIL import Image
    (EXT / 'icons').mkdir(exist_ok=True)
    with Image.open(ROOT / 'icons/icon-192.png') as icon:
        for size in [16,32,48,128]: icon.resize((size,size),Image.Resampling.LANCZOS).save(EXT / f'icons/{size}.png')
    (ROOT / 'downloads').mkdir(exist_ok=True)
    archive = ROOT / 'downloads/packet-party-pocket-search.zip'
    store_archive = ROOT / 'downloads/packet-party-pocket-search-store.zip'
    # The public ZIP has a friendly folder; store uploads need manifest.json at root.
    for target, prefix in [(archive, 'packet-party-pocket-search/'), (store_archive, '')]:
        with ZipFile(target,'w',ZIP_DEFLATED) as zipped:
            for path in sorted(EXT.rglob('*')):
                if path.is_file():
                    info_path = prefix + path.relative_to(EXT).as_posix()
                    from zipfile import ZipInfo
                    entry = ZipInfo(info_path,date_time=(2026,10,24,0,0,0)); entry.compress_type=ZIP_DEFLATED
                    zipped.writestr(entry,path.read_bytes())
    print(f'Packaged {len(questions)} questions, {len(exhibits)} exhibits. ZIP: {archive.stat().st_size:,} bytes')

if __name__ == '__main__': build()
