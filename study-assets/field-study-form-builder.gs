const FIELD_STUDY_NOTIFY_EMAIL = 'andrew@heyjunior.ai';

function createJuniorFieldStudyAssets() {
  const intakeForm = FormApp.create('Junior Field Study Application');
  intakeForm.setDescription('Use Junior free for 1 year in exchange for 4 weeks of honest feedback while you job search.');
  intakeForm.setCollectEmail(false);
  intakeForm.setLimitOneResponsePerUser(false);
  intakeForm.setAllowResponseEdits(false);
  intakeForm.setConfirmationMessage("Thanks for applying. If you're selected, Andrew will follow up with next steps and your free 1-year Junior access within a few days.");

  addIntakeQuestions(intakeForm);

  const responseSheet = SpreadsheetApp.create('Junior Field Study Applications');
  intakeForm.setDestination(FormApp.DestinationType.SPREADSHEET, responseSheet.getId());

  const weeklyForm = FormApp.create('Junior Field Study Weekly Check-In');
  weeklyForm.setDescription('Quick weekly check-in for Junior field study participants. Takes about 2 minutes.');
  weeklyForm.setCollectEmail(false);
  weeklyForm.setLimitOneResponsePerUser(false);
  weeklyForm.setAllowResponseEdits(false);
  addWeeklyQuestions(weeklyForm);

  ScriptApp.newTrigger('sendFieldStudyNotification')
    .forSpreadsheet(responseSheet)
    .onFormSubmit()
    .create();

  Logger.log('Intake edit URL: ' + intakeForm.getEditUrl());
  Logger.log('Intake public URL: ' + intakeForm.getPublishedUrl());
  Logger.log('Response sheet URL: ' + responseSheet.getUrl());
  Logger.log('Weekly edit URL: ' + weeklyForm.getEditUrl());
  Logger.log('Weekly public URL: ' + weeklyForm.getPublishedUrl());
}

function addIntakeQuestions(form) {
  form.addSectionHeaderItem().setTitle('Contact and eligibility');
  addText(form, 'Full name', true);
  addEmail(form, 'Email address', true);
  addText(form, 'LinkedIn profile URL', true);
  addText(form, 'Where are you located? (city/country)', false);
  addMultipleChoice(form, 'Are you currently looking for work?', [
    'Yes, actively applying/interviewing.',
    'Yes, casually looking.',
    'Not right now.',
  ], true);
  addCheckbox(form, 'Which best describes you?', [
    'Recent grad.',
    'Early-career professional (0-3 years experience).',
    'Recently laid off.',
    'Switching careers into tech/data/software.',
    'Mid-career job seeker (4+ years experience).',
    'Other.',
  ], true);

  form.addPageBreakItem().setTitle('Job search context');
  addText(form, 'What roles are you targeting?', true)
    .setHelpText('e.g. "Data Engineer, Software Developer, ML Engineer"');
  addMultipleChoice(form, 'What field are you in?', [
    'Software engineering.',
    'Data engineering / analytics.',
    'AI / ML.',
    'Product / design.',
    'IT / cloud / security.',
    'Other.',
  ], true);
  addMultipleChoice(form, 'How long have you been looking?', [
    'Less than 1 month.',
    '1-3 months.',
    '3-6 months.',
    '6+ months.',
  ], true);
  addMultipleChoice(form, 'About how many jobs have you applied to in the last 30 days?', [
    '0-10.',
    '11-30.',
    '31-75.',
    '75+.',
  ], true);
  addParagraph(form, 'What is your biggest job-search frustration right now?', true);
  addMultipleChoice(form, 'Have you tried networking through LinkedIn comments or replies before?', [
    'Yes, regularly.',
    'Yes, a few times.',
    'No, but I would try it.',
    'No, not interested.',
  ], true);

  form.addPageBreakItem().setTitle('Junior fit and commitment');
  addParagraph(form, 'What would make Junior useful enough for you to keep using after the study?', true);
  addMultipleChoice(form, 'Would you be willing to use Junior during your real job search for 4 weeks?', [
    'Yes.',
    'Maybe, depending on time.',
    'No.',
  ], true);
  addMultipleChoice(form, 'Are you comfortable sharing weekly feedback (5 questions, takes 2 minutes)?', [
    'Yes.',
    'Maybe.',
    'No.',
  ], true);
  addMultipleChoice(form, 'Are you open to a short exit survey and optional 20-minute Zoom interview at the end?', [
    'Yes, both.',
    'Survey only.',
    'No.',
  ], true);

  form.addPageBreakItem().setTitle('Consent and expectations');
  addCheckbox(form, 'Consent', [
    'I understand this is a product field study, not employment support or a guarantee of interviews or job offers. I agree to share honest feedback about my experience using Junior. My responses may be used in anonymized or aggregated form to improve the product.',
  ], true);
  addCheckbox(form, 'Optional testimonial permission', [
    'If Junior helps me, you may follow up to ask whether I am comfortable sharing a quote or short testimonial.',
  ], false);
  addParagraph(form, 'Anything else we should know?', false);
}

function addWeeklyQuestions(form) {
  addEmail(form, 'Email address', true);
  addMultipleChoice(form, 'Which week is this?', [
    'Week 1.',
    'Week 2.',
    'Week 3.',
    'Week 4.',
  ], true);
  addMultipleChoice(form, 'How many times did you use Junior this week?', [
    '0.',
    '1-2.',
    '3-5.',
    '6+.',
  ], true);
  addMultipleChoice(form, 'Did any recruiter or hiring manager respond to a comment Junior helped you write?', [
    'Yes.',
    'No.',
    'Not sure.',
  ], true);
  addParagraph(form, 'What worked well this week?', true);
  addParagraph(form, 'What felt awkward or unhelpful?', true);
  addParagraph(form, 'Anything else you want to share?', false);
}

function sendFieldStudyNotification(e) {
  const values = e.namedValues || {};
  const spreadsheet = e.source || SpreadsheetApp.getActiveSpreadsheet();
  const fullName = getAnswer(values, 'Full name') || 'Unknown applicant';

  const body = [
    'New Junior field study application received.',
    '',
    `Name: ${fullName}`,
    `Email: ${getAnswer(values, 'Email Address') || getAnswer(values, 'Email address')}`,
    `LinkedIn: ${getAnswer(values, 'LinkedIn profile URL')}`,
    `Location: ${getAnswer(values, 'Where are you located? (city/country)')}`,
    `Target roles: ${getAnswer(values, 'What roles are you targeting?')}`,
    `Currently looking: ${getAnswer(values, 'Are you currently looking for work?')}`,
    `Describes them: ${getAnswer(values, 'Which best describes you?')}`,
    `Search duration: ${getAnswer(values, 'How long have you been looking?')}`,
    `Applications last 30 days: ${getAnswer(values, 'About how many jobs have you applied to in the last 30 days?')}`,
    `Biggest frustration: ${getAnswer(values, 'What is your biggest job-search frustration right now?')}`,
    `4-week commitment: ${getAnswer(values, 'Would you be willing to use Junior during your real job search for 4 weeks?')}`,
    `Weekly feedback: ${getAnswer(values, 'Are you comfortable sharing weekly feedback (5 questions, takes 2 minutes)?')}`,
    `Exit interview: ${getAnswer(values, 'Are you open to a short exit survey and optional 20-minute Zoom interview at the end?')}`,
    '',
    `Open the response sheet: ${spreadsheet ? spreadsheet.getUrl() : ''}`,
  ].join('\n');

  MailApp.sendEmail({
    to: FIELD_STUDY_NOTIFY_EMAIL,
    subject: `New field study application: ${fullName}`,
    body,
  });
}

function addText(form, title, required) {
  return form.addTextItem().setTitle(title).setRequired(required);
}

function addEmail(form, title, required) {
  const validation = FormApp.createTextValidation()
    .requireTextIsEmail()
    .build();

  return form.addTextItem()
    .setTitle(title)
    .setRequired(required)
    .setValidation(validation);
}

function addParagraph(form, title, required) {
  return form.addParagraphTextItem().setTitle(title).setRequired(required);
}

function addMultipleChoice(form, title, options, required) {
  const item = form.addMultipleChoiceItem().setTitle(title).setRequired(required);
  item.setChoices(options.map((option) => item.createChoice(option)));
  return item;
}

function addCheckbox(form, title, options, required) {
  const item = form.addCheckboxItem().setTitle(title).setRequired(required);
  item.setChoices(options.map((option) => item.createChoice(option)));
  return item;
}

function getAnswer(values, label) {
  const value = values[label];

  if (!value) {
    return '';
  }

  return Array.isArray(value) ? value.join(', ') : String(value);
}
