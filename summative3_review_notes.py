"""Keep conflicting source keys visible without inventing a replacement key."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def apply_supplement(data, notes):
    """Append reviewed additions without changing existing question IDs."""
    path = ROOT / 'summative3-supplement.json'
    if not path.exists():
        return
    supplement = json.loads(path.read_text(encoding='utf-8'))
    by_id = {q['id']: q for q in data['questions']}
    for question in supplement['questions']:
        if question['id'] in by_id:
            if by_id[question['id']]['question'] != question['question']:
                raise ValueError('Supplement ID collides with another question')
            by_id[question['id']].update(question)
        else:
            data['questions'].append(question)
    notes.update(supplement['explanations'])
    data['questionCount'] = len(data['questions'])
    if 'SUMMATIVE 3.pdf' not in data['sourceFiles']:
        data['sourceFiles'].append('SUMMATIVE 3.pdf')

def annotate_conflicts(questions, notes, audit):
    by_id = {q['id']: q for q in questions}
    for left_id, right_id in audit['answerConflicts']:
        left, right = by_id[left_id], by_id[right_id]
        for current, alternate in [(left, right), (right, left)]:
            source = current['sources'][0]['sourceFile'].removesuffix('.mhtml')
            current['answerKeyWarning'] = 'The saved reviews disagree on this item. This copy follows the labeled answer in ' + source + '.'
            marker = '<p><em>' + current['answerKeyWarning'] + '</em></p>'
            if not current['questionHtml'].startswith(marker):
                current['questionHtml'] = marker + current['questionHtml']
            notes[str(current['id'])] = ('Source key: ' + ' · '.join(current['correctAnswers']) + '.\n'
                'Source disagreement: Another saved review marks “' + ' · '.join(alternate['correctAnswers']) + '” as correct for the same question and choices. Both labeled versions are retained; these source keys are inconsistent.')

def write_summary(audit):
    content = f'''# Summative 3 import

The separate Summative 3 deck imports all nine supplied MHTML reviews. It contains **{audit['questionCount']} unique questions** after removing {len(audit['duplicates'])} repeated question/choice/answer sets. {len(audit['variantGroups'])} repeated-stem groups retain different choices or answer keys. Choice order does not create a new question; different exhibits do.

Correct answers come from Canvas's `correct_answer` labels, including when the student's selected answer was wrong. The importer reads question content only and does not execute saved document scripts.

Two partial final questions were recovered from complete copies in other files. One empty/template region in Q4 was ignored. There are no unresolved answer keys or missing exhibits. The 15 exhibit questions use 12 locally saved image files.

One source-key conflict is retained and flagged: the slow WLAN / dual-band router question is keyed as firmware update in one source version and splitting traffic between 2.4 and 5 GHz in another. The import preserves both labeled keys and does not claim to resolve that disagreement.

The deck has its own practice saves, ranked progress, leaderboards, and live rooms. Training offers 20, 30, or the entire deck. Run `python build_summative3.py` with the original files in `../QUESTION POOLS` to regenerate it; downloaded exhibits are cached by a hash of their source path, with no signed source URLs published.

## PDF follow-up

All 26 pages of `SUMMATIVE 3.pdf` were compared with the bank: 224 question occurrences on pages 1–23 and 36 repeated study-summary occurrences on pages 24–26. One missing statement was added as stable ID 210, bringing the playable deck to **210 questions**. Its answer is **False per the user's explicit instruction**, while page 13, question 146 highlights **True**; the explanation records that disagreement. The PDF also repeats both conflicting WLAN keys for IDs 110 and 168. Other questions, choice variants and visible highlighted keys were already represented; a truncated `acces` on page 18 maps to the existing supplicant question 42. Four occurrences without detectable yellow highlights keep their MHTML labels. This is a source comparison, not a claim that every source answer is technically correct. See `summative3-pdf-audit.json` for the comparison and `summative3-supplement.json` for the reproducible addition.
'''
    (ROOT / 'SUMMATIVE3_IMPORT_NOTES.md').write_text(content, encoding='utf-8')

if __name__ == '__main__':
    data = json.loads((ROOT / 'summative3-questions.json').read_text(encoding='utf-8'))
    notes = json.loads((ROOT / 'summative3-explanations.json').read_text(encoding='utf-8'))
    audit = json.loads((ROOT / 'summative3-import-audit.json').read_text(encoding='utf-8'))
    annotate_conflicts(data['questions'], notes, audit)
    apply_supplement(data, notes)
    for filename, value in [('summative3-questions.json', data), ('summative3-explanations.json', notes)]:
        (ROOT / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    write_summary(audit)
