from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, HRFlowable
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from pathlib import Path

OUT = Path('output/pdf/ECFA_Public_Website_Features_Guide.pdf')
OUT.parent.mkdir(parents=True, exist_ok=True)

BRASS = colors.HexColor('#B59025')
INK = colors.HexColor('#131F29')
MUTED = colors.HexColor('#66727B')
PALE = colors.HexColor('#F3F5F6')
LINE = colors.HexColor('#D9DEE2')
GREEN = colors.HexColor('#1B6E3C')

font_regular = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font_bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
pdfmetrics.registerFont(TTFont('DejaVu', font_regular))
pdfmetrics.registerFont(TTFont('DejaVu-Bold', font_bold))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle', fontName='DejaVu-Bold', fontSize=26, leading=31, textColor=colors.white, alignment=TA_LEFT, spaceAfter=10))
styles.add(ParagraphStyle(name='CoverSub', fontName='DejaVu', fontSize=12, leading=18, textColor=colors.white))
styles.add(ParagraphStyle(name='H1x', fontName='DejaVu-Bold', fontSize=20, leading=25, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name='H2x', fontName='DejaVu-Bold', fontSize=13, leading=17, textColor=BRASS, spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name='Bodyx', fontName='DejaVu', fontSize=9.2, leading=14, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name='Smallx', fontName='DejaVu', fontSize=7.8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name='CardTitle', fontName='DejaVu-Bold', fontSize=10.5, leading=14, textColor=INK, spaceAfter=3))
styles.add(ParagraphStyle(name='CardBody', fontName='DejaVu', fontSize=8.4, leading=12.5, textColor=MUTED))
styles.add(ParagraphStyle(name='Number', fontName='DejaVu-Bold', fontSize=16, leading=18, textColor=BRASS, alignment=TA_CENTER))

def p(text, style='Bodyx'):
    return Paragraph(text, styles[style])

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(BRASS)
    canvas.rect(0, h - 13*mm, w, 13*mm, fill=1, stroke=0)
    canvas.setFont('DejaVu-Bold', 8)
    canvas.setFillColor(colors.white)
    canvas.drawString(18*mm, h - 8.3*mm, 'EDINBURGH CHURCHES FOOTBALL ASSOCIATION')
    canvas.setStrokeColor(LINE)
    canvas.line(18*mm, 15*mm, w-18*mm, 15*mm)
    canvas.setFillColor(MUTED)
    canvas.setFont('DejaVu', 7.5)
    canvas.drawString(18*mm, 9.5*mm, 'Public website features guide | ecfa-website.vercel.app')
    canvas.drawRightString(w-18*mm, 9.5*mm, f'Page {doc.page}')
    canvas.restoreState()

def section_title(title, intro=None):
    block = [p(title, 'H1x'), HRFlowable(width='100%', thickness=2, color=BRASS, spaceAfter=10)]
    if intro:
        block.append(p(intro))
    return block

def feature_card(title, body):
    return Table([[p(title, 'CardTitle')], [p(body, 'CardBody')]], colWidths=[82*mm], style=TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), PALE),
        ('BOX', (0,0), (-1,-1), 0.7, LINE),
        ('LINEBELOW', (0,0), (-1,0), 1.5, BRASS),
        ('LEFTPADDING', (0,0), (-1,-1), 9), ('RIGHTPADDING', (0,0), (-1,-1), 9),
        ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))

def card_grid(cards):
    rows = []
    for i in range(0, len(cards), 2):
        left = feature_card(*cards[i])
        right = feature_card(*cards[i+1]) if i+1 < len(cards) else ''
        rows.append([left, right])
    return Table(rows, colWidths=[85*mm, 85*mm], hAlign='LEFT', style=TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0), ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))

story = []

# Cover
cover = Table([[p('ECFA WEBSITE', 'CoverSub')], [p('Public Features Guide', 'CoverTitle')],
               [p('A practical guide to fixtures, results, competitions, teams, players, referees, records, downloads and ways to contact the league.', 'CoverSub')]],
              colWidths=[174*mm], rowHeights=[16*mm, 34*mm, 37*mm], style=TableStyle([
                  ('BACKGROUND', (0,0), (-1,-1), INK),
                  ('LINEABOVE', (0,0), (-1,0), 6, BRASS),
                  ('LEFTPADDING', (0,0), (-1,-1), 17), ('RIGHTPADDING', (0,0), (-1,-1), 17),
                  ('TOPPADDING', (0,0), (-1,-1), 10), ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                  ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
              ]))
story += [Spacer(1, 35*mm), cover, Spacer(1, 18*mm)]
story.append(Table([[p('WEBSITE', 'Smallx'), p('https://ecfa-website.vercel.app', 'CardTitle')],
                    [p('GUIDE UPDATED', 'Smallx'), p('16 September 2026', 'CardTitle')]],
                   colWidths=[35*mm, 125*mm], style=TableStyle([
                       ('BOX', (0,0), (-1,-1), 0.7, LINE), ('INNERGRID', (0,0), (-1,-1), 0.5, LINE),
                       ('BACKGROUND', (0,0), (0,-1), PALE), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                       ('LEFTPADDING', (0,0), (-1,-1), 9), ('RIGHTPADDING', (0,0), (-1,-1), 9),
                       ('TOPPADDING', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                   ])))
story.append(PageBreak())

# Getting started + match hub
story += section_title('1. Getting around the website', 'The website is designed for phones, tablets and computers. The main navigation bar scrolls horizontally on smaller screens, so every section remains available without crowding the display.')
story.append(card_grid([
    ('Match Hub', 'The front page for fixtures and results, organised by match date.'),
    ('Competitions', 'League tables, cup structures, fixtures, results and competition detail.'),
    ('Scorers', 'Current-season and all-time goalscorer tables with player links.'),
    ('Honours and History', 'Past winners, team honours and previous-season records.'),
    ('Teams and Referees', 'Dedicated statistical views for clubs, players and match officials.'),
    ('Downloads and Search', 'Export public data or search names, teams, competitions and pages.'),
]))
story += [Spacer(1, 8), p('<b>Tip:</b> On a phone, swipe the top navigation left or right to reveal additional sections.', 'Bodyx')]
story += [Spacer(1, 7)] + section_title('2. Match Hub', 'The Match Hub brings the main matchday information together in one place.')
story.append(card_grid([
    ('Browse by date', 'Move between available matchdays to see a particular weekend. The website remembers the date being viewed when navigating away and returning.'),
    ('Upcoming fixtures', 'See the competition, home and away teams, badges, kick-off time, venue and appointed referee when available.'),
    ('Results and scores', 'Completed games show the score and link to an individual match page.'),
    ('Match details', 'Open a fixture to review match information and any recorded scorers or related public details.'),
    ('Current standings', 'A league-table snapshot provides a quick view of team positions and performance.'),
    ('Weekend context', 'The front page automatically prioritises upcoming games or recent results depending on the day.'),
]))
story.append(PageBreak())

# Competitions and stats
story += section_title('3. Competitions, tables and cups', 'Competition pages separate the league and cup tournaments while keeping their fixtures and progress easy to follow.')
story.append(card_grid([
    ('League standings', 'View played, won, drawn, lost, goals for, goals against, goal difference and points.'),
    ('League fixtures and results', 'Review scheduled and completed games within the selected competition.'),
    ('Cup progress', 'Follow rounds, group stages and knockout fixtures, including round labels and next-stage possibilities where available.'),
    ('Competition switching', 'Move between the Appin Sports League, ECFA Knockout Cup, ECFA League Cup and Brian Latto Cup.'),
]))
story += [Spacer(1, 10)] + section_title('4. Scorers and player information')
story.append(card_grid([
    ('Season scorer tables', 'Select the current season or a previous recorded season to rank goalscorers.'),
    ('All-time scorers', 'Combine every recorded ECFA season into an overall career goals table.'),
    ('Player profiles', 'View a player’s current team, current and historical goals, and recorded yellow and red cards.'),
    ('Scoring history', 'Historical goals are totalled by season and team, avoiding duplicate single-goal lines.'),
    ('Match-linked goals', 'Where source data exists, scoring records can be connected to the relevant fixture.'),
    ('Name search', 'Find current players and historical scorers using full or partial names.'),
]))
story += [Spacer(1, 10)] + section_title('5. Teams')
story.append(card_grid([
    ('Team overview', 'Choose a club to see its badge, manager, squad and current information.'),
    ('Form and fixtures', 'Review recent form, the latest result, the next fixture and a wider fixture list.'),
    ('Results by season', 'Switch between the current campaign and available historical seasons.'),
    ('Team scorers and honours', 'See season-by-season scorers and honours won by the club.'),
]))

# Records/referees
story += section_title('6. Honours and historical records')
story.append(card_grid([
    ('Major honours', 'A season-by-season grid records winners of the League, League Cup, Knockout Cup and Brian Latto Cup.'),
    ('All-time honours table', 'Compare clubs by competition wins and total major honours.'),
    ('Historical seasons', 'Browse archived league tables, fixtures and results from previous campaigns where records are available.'),
    ('Linked team records', 'Team names in honours and historical areas link back to current team pages when a match is available.'),
]))
story += [Spacer(1, 10)] + section_title('7. Referee information', 'The referee section builds a public statistical picture from recorded appointments and discipline data.')
story.append(card_grid([
    ('Officials list', 'Search and select a referee to view recorded information.'),
    ('Games officiated', 'Review matches, dates, teams, scores, competitions and venues.'),
    ('Venue and team breakdowns', 'See where an official has refereed and the teams involved in their appointments.'),
    ('Cards summary', 'Recorded yellow and red cards can be reviewed by match and player where the source data is available.'),
    ('Season selection', 'Choose the current season, last season or all available seasons.'),
    ('Referee reports', 'Create a referee report and download it in PDF or Word format.'),
]))
story += [Spacer(1, 10)] + section_title('8. Sponsors')
story.append(p('The sponsors page groups sponsors beneath the competitions they support. Each entry includes a logo badge, a short summary, a link to the sponsor’s website and a direct route to the sponsored competition.'))

story += [Spacer(1, 10)] + section_title('9. Charity')
story.append(card_grid([
    ('League charities by season', 'See the ECFA nominated charity for each season, information about its work and links to its website.'),
    ('League charity events', 'Review planned and completed league fundraising events, dates, formats and confirmed totals.'),
    ('Team events by season', 'Discover fundraising organised by individual ECFA clubs and follow links to supported campaigns.'),
    ('Charity enquiries', 'Use the Charity Enquiry option in Contact Us for questions about the league charity, forthcoming events or adding a team fundraiser.'),
]))

# downloads
story += section_title('10. Public downloads and reports', 'The Downloads area makes ECFA information reusable without requiring administrator access. Published league files can be viewed online, downloaded, or offered with both choices. Availability depends on the records held for each season.')
download_rows = [
    ['Download', 'What it contains', 'Formats'],
    ['Current-season scorers', 'Each scorer and their current-season goal total', 'CSV / Excel'],
    ['Historical scorers', 'Player, team, season and recorded goals', 'CSV / Excel'],
    ['Current fixtures and results', 'Dates, teams, scores, venues, referees and competition details', 'CSV / Excel'],
    ['Previous-season results', 'The available historical fixture and result archive', 'CSV / Excel'],
    ['Referee statistics', 'Games, teams, venues, results and recorded cards', 'CSV / Excel'],
    ['Player scoring report', 'Selected player, current team, fixture-linked goals and season totals', 'PDF / Word'],
    ['Referee report', 'Selected referee’s games, venues, teams, results and cards', 'PDF / Word'],
    ['Published league files', 'Handbooks, guides and other documents uploaded by ECFA administrators', 'View / Download'],
    ['Large public-data export', 'A broad collection of relevant public ECFA records', 'CSV / Excel'],
]
tbl = Table([[p(str(v), 'CardTitle' if i == 0 else 'CardBody') for v in row] for i,row in enumerate(download_rows)], colWidths=[45*mm, 91*mm, 32*mm], repeatRows=1)
tbl.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), INK), ('TEXTCOLOR', (0,0), (-1,0), colors.white),
    ('GRID', (0,0), (-1,-1), 0.5, LINE), ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, PALE]),
    ('LEFTPADDING', (0,0), (-1,-1), 7), ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('TOPPADDING', (0,0), (-1,-1), 7), ('BOTTOMPADDING', (0,0), (-1,-1), 7),
]))
story += [tbl, Spacer(1, 10), p('<b>Using downloads:</b> Where available, select <b>View</b> to read a file without saving it to the device, or <b>Download</b> to keep a copy. CSV files suit data analysis and imports; Excel files open as formatted workbooks; PDF and Word reports are designed for viewing and sharing.')]
story += [Spacer(1, 8)] + section_title('11. Whole-site search')
story.append(card_grid([
    ('Partial-name searching', 'Enter part of a player, referee, team or manager name to receive matching results.'),
    ('Pages and competitions', 'Search also returns relevant website pages and competition links.'),
    ('Current and historical players', 'Current squad records and historical scorer records can both appear.'),
    ('Direct navigation', 'Each result links to the most relevant team, player, competition or statistics page.'),
]))
story.append(PageBreak())

# stats and contact
story += section_title('12. Website statistics')
story.append(card_grid([
    ('Seven-day activity', 'A daily chart shows today and the previous six days of actual recorded page views.'),
    ('Headline totals', 'Summary cards show recent and longer-term website usage.'),
    ('Popular pages', 'Tables identify the most visited match, competition, team, player and other pages.'),
    ('Public transparency', 'Visitors can see how the ECFA website is being used without accessing private administration data.'),
]))
story += [Spacer(1, 10)] + section_title('13. Contacting the ECFA')
story.append(card_grid([
    ('General query', 'Send a question with a name, message and either an email address or mobile number.'),
    ('Sponsorship enquiry', 'Contact the league about supporting ECFA competitions and activities.'),
    ('Charity enquiry', 'Ask about the nominated charity, league fundraising events or adding a team-led charity event.'),
    ('Apply to join the league', 'Read the registration criteria, confirm suitability and submit team, church, minister and mission information.'),
    ('Report an error', 'Tell the ECFA about incorrect information, a broken page or another website problem. Contact details are optional.'),
    ('Request a feature', 'Suggest an improvement or new website facility through the same reporting form.'),
    ('Confirmation', 'The website confirms when a message or application has been successfully submitted.'),
]))
story += [Spacer(1, 12)]
story.append(Table([[p('Privacy note', 'CardTitle'), p('Public pages display league information intended for general visitors. Private administration tools, contact messages and internal discipline-management functions require an authorised login and are not covered by this public guide.', 'CardBody')]], colWidths=[35*mm, 133*mm], style=TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), PALE), ('BOX', (0,0), (-1,-1), 0.7, LINE),
    ('LINEBEFORE', (0,0), (0,-1), 4, BRASS), ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('LEFTPADDING', (0,0), (-1,-1), 9), ('RIGHTPADDING', (0,0), (-1,-1), 9),
    ('TOPPADDING', (0,0), (-1,-1), 9), ('BOTTOMPADDING', (0,0), (-1,-1), 9),
])))
story.append(PageBreak())

# quick start
story += section_title('Quick-start guide', 'Four common journeys for first-time visitors.')
steps = [
    ('1', 'Find this weekend’s games', 'Open Match Hub, select the relevant date and tap a fixture for more detail.'),
    ('2', 'Check a league position', 'Open Competitions, select the league and review the standings table.'),
    ('3', 'Look up a person', 'Open Search, type at least part of the player or referee name and select a result.'),
    ('4', 'Download information', 'Open Downloads, choose the required dataset or individual report and select a format.'),
]
for number,title,body in steps:
    story.append(Table([[p(number,'Number'), p(title,'CardTitle'), p(body,'CardBody')]], colWidths=[18*mm, 50*mm, 100*mm], style=TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), PALE), ('BOX', (0,0), (-1,-1), 0.7, LINE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'), ('LEFTPADDING', (0,0), (-1,-1), 9),
        ('RIGHTPADDING', (0,0), (-1,-1), 9), ('TOPPADDING', (0,0), (-1,-1), 10), ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ])))
    story.append(Spacer(1, 6))

story += [Spacer(1, 8), HRFlowable(width='100%', thickness=2, color=BRASS, spaceAfter=12)]
story.append(p('<b>Edinburgh Churches Football Association</b>', 'H2x'))
story.append(p('Public website: <link href="https://ecfa-website.vercel.app" color="#B59025">https://ecfa-website.vercel.app</link>'))
story.append(p('For questions, sponsorship enquiries, new-team applications or website feedback, use the Contact Us section on the website.'))

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=22*mm, bottomMargin=20*mm, title='ECFA Public Website Features Guide', author='Edinburgh Churches Football Association')
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT.resolve())
