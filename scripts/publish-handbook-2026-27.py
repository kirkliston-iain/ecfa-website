from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
import re, subprocess

root=Path(__file__).resolve().parents[1]
src=root/'public/documents/ECFA-League-Handbook-2026-27.docx'
pdf=root/'public/documents/ECFA-League-Handbook-2026-27.pdf'
doc=Document(src)

def replace(old,new):
    found=False
    for p in doc.paragraphs:
        if old in p.text:
            for r in p.runs: r.text=''
            p.runs[0].text=p.text.replace(old,new) if False else new
            found=True
            break
    if not found: raise RuntimeError('Missing paragraph: '+old[:70])

def exact(old,new):
    for p in doc.paragraphs:
        if old in p.text:
            current=p.text
            for r in p.runs: r.text=''
            p.runs[0].text=current.replace(old,new)
            return
    raise RuntimeError('Missing text '+old)

exact('Standard match fee: £55 per game, to be collected from the away team.', 'Standard referee fee: £55 per game, shared equally (£27.50 per team). The home team pays the referee, and the away team reimburses the home team £27.50.')
exact('ECFA Kwik Fit Cup','ECFA Appin League Cup')
exact('Four Groups','Two groups')
exact('Top 4 Qualify from each group Top v 4th','The top four teams from each group qualify for the quarter-finals (eight teams in total). Quarter-final pairings follow the published competition draw on the ECFA website.')
exact('Three Teams receive a bye into the Quarter finals','Four teams receive a bye into the quarter-finals, selected by random draw.')
exact('10 teams play for a place in the quarter finals','The other eight teams contest four preliminary-round ties. The four winners join the four teams receiving byes in the quarter-finals.')
exact('All teams to advise Ian Midwinter Close of Play Tuesday if unable to fulfil a fixture, failure to do this will result in a forfeit and a 3-0 loss, and team may need to pay cost of park (if within 48 hours) and referee on the day.', 'Teams must advise the fixture organiser and opposition before Monday of the match week if they cannot fulfil a Saturday fixture. Midweek fixtures require at least three working days’ notice. The postponement rules in section 11 apply.')
exact('Teams can request one postponement per season, however must inform Iain McCalman before Monday the week of the match when a Saturday, and if a midweek match at least 3 working days to stop any additional costs being passed to the team.', 'Each team may request one postponement per season. For Saturday fixtures, the request must be made before Monday of the match week; for midweek fixtures, at least three working days’ notice is required (see section 11).')
exact('Home team must pay the referee his fee by 6pm the same day of the game, either by bank transfer, or cash on the day.', 'Home team must pay the referee the full £55 by 6pm on matchday, by bank transfer or cash. The referee fee is split equally between the teams (£27.50 each).')
exact('Away team must pay the home team their share (50%) of the fees by Thursday evening 11pm.', 'Away team must reimburse the home team £27.50 for its half of the referee fee by Thursday at 11pm. Other pitch-related fees remain subject to existing arrangements.')
exact('The league has two main sponsors - Appin Sports, who have sponsored the league for the 2026/27 Season, this is called the Appin ECFL (Edinburgh Churches Football Association) and also Kwik Fit, who have sponsored the ECFA Cup, previously the league cup, and now known as the ECFA Kwik Fit Cup','The ECFA recognises Appin Sports and Kwik Fit as league sponsors. The 2026/27 league competition is the Appin Sports League, and the group-stage cup competition is named the ECFA Appin League Cup. Current sponsor details are published on the ECFA website.')
exact('A player cannot play for more than two ECFA teams per season. In exceptional circumstances, a special request can be submitted to the league for approval if a player has already transferred twice or appeared for two separate teams.', 'A player cannot represent more than two ECFA teams in a season unless the league expressly approves an exceptional request in advance. Managers must submit the circumstances for review before the player appears for any further ECFA team.')

# Remove obsolete trialist section from heading through end.
remove=False
for p in list(doc.paragraphs):
    if 'Trialist Rule (Removed 27/08/2025)' in p.text: remove=True
    if remove: p._element.getparent().remove(p._element)

# Add compact guidance alongside existing transfer policy.
for p in doc.paragraphs:
    if '24 - ECFA Transfers and Player Eligibility Policy' in p.text:
        anchor=p
        break
else: raise RuntimeError('Transfer heading missing')
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
items=[
'Before fielding a new or transferred player, check registration and competition eligibility.',
'Confirm previous ECFA teams and complete the transfer form where required.',
'Confirm the player is not concurrently registered with an ineligible outside club.',
'Check outstanding suspensions and the 1 April and Knockout Cup restrictions.',
'A third ECFA club requires express exceptional league approval in advance.',
'If uncertain, seek league confirmation before selecting the player.'
]
for item in reversed(items):
    el=OxmlElement('w:p'); anchor._p.addnext(el)
    q=Paragraph(el,anchor._parent); q.text=item
el=OxmlElement('w:p');anchor._p.addnext(el);q=Paragraph(el,anchor._parent);q.text='Manager eligibility checklist';q.style='Heading 2'

for p in doc.paragraphs:
    if p.text.strip()=='ECFA Knockout Cup':
        el=OxmlElement('w:p');p._p.addnext(el)
        q=Paragraph(el,p._parent)
        q.text='The complete draw is made before the competition begins. Four byes are selected at random, and all potential quarter-final, semi-final and final pairings are fixed from the outset. No further draws take place. The live bracket is published on the ECFA website.'
        break

# Correct contents labels and provide page references based on revised pagination.
pages=[3,3,5,5,5,5,5,7,7,9,10,10,10,10,10,11,11,11,12,13,14,15,16,16,18]
for p in doc.paragraphs:
    m=re.match(r'^\s*(\d{1,2})\s*[-–]\s*(.+)
    if not m or '···' in p.text:continue
    i=int(m.group(1))
    if 1<=i<=25 and not ('Last Updated' in p.text and p.style.name.startswith('Heading')):
        if p.text.strip().startswith(('1 - Last Updated','2 - Disciplinary','3 - ECFA Honours')) and p.style.name.startswith('Heading'):continue
        if p.style.name.startswith('Heading'):continue
        old=p.text
        for r in p.runs:r.text=''
        p.add_run(old.strip()+'  ···  '+str(pages[i-1]))
        if i==25:break

normal=doc.styles['Normal'];normal.font.name='Aptos';normal.font.size=Pt(9.5)
normal.paragraph_format.space_after=Pt(5)
normal.paragraph_format.line_spacing=1.12
for name in ('Heading 1','Heading 2'):
    s=doc.styles[name];s.font.name='Aptos Display';s.font.bold=True
    s.font.size=Pt(15 if name=='Heading 1' else 11.5)
    s.paragraph_format.keep_with_next=True

doc.save(src)
tmp=root/'handbook-build';tmp.mkdir(exist_ok=True)
subprocess.run(['libreoffice','-env:UserInstallation=file:///tmp/lo-ecfa-handbook','--headless','--convert-to','pdf','--outdir',str(tmp),str(src)],check=True)
built=tmp/src.with_suffix('.pdf').name
assert built.exists()
pdf.write_bytes(built.read_bytes())
from pypdf import PdfReader
reader=PdfReader(str(pdf))
text=' '.join(p.extract_text() or '' for p in reader.pages)
assert 'ECFA Appin League Cup' in text
assert 'Trialist Rule' not in text
assert 'Four teams receive a bye' in text
print('Published handbook PDF pages:',len(reader.pages))
,p.text.strip())
    if not m or '···' in p.text:continue
    i=int(m.group(1))
    if 1<=i<=25 and not ('Last Updated' in p.text and p.style.name.startswith('Heading')):
        if p.text.strip().startswith(('1 - Last Updated','2 - Disciplinary','3 - ECFA Honours')) and p.style.name.startswith('Heading'):continue
        if p.style.name.startswith('Heading'):continue
        old=p.text
        for r in p.runs:r.text=''
        p.add_run(old.strip()+'  ···  '+str(pages[i-1]))
        if i==25:break

normal=doc.styles['Normal'];normal.font.name='Aptos';normal.font.size=Pt(9.5)
normal.paragraph_format.space_after=Pt(5)
normal.paragraph_format.line_spacing=1.12
for name in ('Heading 1','Heading 2'):
    s=doc.styles[name];s.font.name='Aptos Display';s.font.bold=True
    s.font.size=Pt(15 if name=='Heading 1' else 11.5)
    s.paragraph_format.keep_with_next=True

doc.save(src)
tmp=root/'handbook-build';tmp.mkdir(exist_ok=True)
subprocess.run(['libreoffice','-env:UserInstallation=file:///tmp/lo-ecfa-handbook','--headless','--convert-to','pdf','--outdir',str(tmp),str(src)],check=True)
built=tmp/src.with_suffix('.pdf').name
assert built.exists()
pdf.write_bytes(built.read_bytes())
from pypdf import PdfReader
reader=PdfReader(str(pdf))
text=' '.join(p.extract_text() or '' for p in reader.pages)
assert 'ECFA Appin League Cup' in text
assert 'Trialist Rule' not in text
assert 'Four teams receive a bye' in text
print('Published handbook PDF pages:',len(reader.pages))
