import argparse, json
from pathlib import Path
from src.parser import parse_pdf, filter_records, records_to_dicts


def main():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
        
    ap = argparse.ArgumentParser(description='Deterministic DIU CSE routine PDF parser (no OCR/AI).')
    ap.add_argument('pdf')
    ap.add_argument('--batch')
    ap.add_argument('--section')
    ap.add_argument('--course')
    ap.add_argument('--teacher')
    ap.add_argument('--room')
    ap.add_argument('--output', default='output/routine.json')
    args = ap.parse_args()

    result = parse_pdf(args.pdf)
    records = filter_records(result.records, args.batch, args.section, args.course, args.teacher, args.room)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(records_to_dicts(records), indent=2), encoding='utf-8')

    print(f'Pages processed: {result.summary.pages_processed}')
    print(f'Total records parsed: {len(result.records)}')
    print(f'Records after filters: {len(records)}')
    print(f'Repairs applied: {len(result.repairs)}')
    for repair in result.repairs[:20]:
        print(f'  [repair p{repair.page} {repair.day}] {repair.message}')
    if len(result.repairs) > 20:
        print(f'  ... {len(result.repairs)-20} more repairs')
    print(f'Warnings: {len(result.warnings)}')
    for w in result.warnings[:20]:
        print(f'  [p{w.page} {w.day}] {w.message}')
    if len(result.warnings) > 20:
        print(f'  ... {len(result.warnings)-20} more warnings')
    print(f'JSON: {out}')

    for r in records:
        print(f'{r.day:10} {r.start_time}-{r.end_time}  {r.course_code:7} {r.group_code:15} {r.room:25} {r.teacher}')

if __name__ == '__main__':
    main()
