// NOTE: This is the Gmail (MailApp) fallback. The Postmark script is the
// production path. Remove this script's onFormSubmit trigger from the
// spreadsheet so only the Postmark script fires. Keep this file in the repo
// as a reference in case Postmark is unavailable.

const NOTIFICATION_EMAIL = 'andrew@heyjunior.ai';
const SENDER_DISPLAY_NAME = 'Andrew from Junior';
const WEEKLY_CHECK_IN_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc9c_g8yTNU3JtZordsEJ5plsI1wHw2yG2pUjFlrjPFjlGdXg/viewform';
const REGISTER_URL = 'https://heyjunior.ai/register.html?src=field-study';
const ONBOARDING_CALENDLY_URL = 'https://calendly.com/andrew_malinow_phd';
const DESKTOP_RELEASES_API_URL = 'https://api.github.com/repos/Andrew-AI-JR/Desktop-Releases/releases/latest';
const DESKTOP_RELEASES_URL = 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/latest';
const FIELD_STUDY_CAPACITY = 10;

function setupFieldStudyTrigger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const existing = ScriptApp.getProjectTriggers().filter(
    (trigger) => trigger.getHandlerFunction() === 'sendFieldStudyNotification'
  );

  existing.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendFieldStudyNotification')
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();
}

function countAcceptedApplicants() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Form Responses 1') || spreadsheet.getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((h) => String(h || '').trim());
  const statusIdx = headers.indexOf('Onboarding email status');
  if (statusIdx < 0) {
    return 0;
  }

  const statuses = sheet.getRange(2, statusIdx + 1, lastRow - 1, 1).getValues();
  let count = 0;
  for (let i = 0; i < statuses.length; i += 1) {
    const s = String(statuses[i][0] || '');
    if (s.indexOf('sent: trigger') === 0 || s.indexOf('sent: backfill') === 0) {
      count += 1;
    }
  }
  return count;
}

function sendFieldStudyNotification(e) {
  const values = e.namedValues || {};
  const spreadsheet = e.source || SpreadsheetApp.getActiveSpreadsheet();
  const sheetUrl = spreadsheet ? spreadsheet.getUrl() : '';
  const fullName = getAnswer(values, 'Full name') || 'Unknown applicant';
  const applicantEmail = getAnswer(values, 'Email address');
  const studyFull = countAcceptedApplicants() >= FIELD_STUDY_CAPACITY;

  sendInternalNotification(values, fullName, applicantEmail, sheetUrl, studyFull);

  if (applicantEmail) {
    if (!studyFull) {
      sendApplicantOnboardingEmail(applicantEmail, fullName);
    } else {
      sendFieldStudyClosedEmail(applicantEmail, fullName);
    }
  }
}

function sendInternalNotification(values, fullName, applicantEmail, sheetUrl, studyFull) {
  const tag = studyFull ? '[STUDY FULL]' : '[ACCEPTED]';
  const body = [
    'New Junior field study application received.',
    '',
    `Name: ${fullName}`,
    `Email: ${applicantEmail}`,
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
    `Open the response sheet: ${sheetUrl}`,
  ].join('\n');

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: `${tag} New field study application: ${fullName}`,
    body,
  });
}

function sendApplicantOnboardingEmail(email, fullName) {
  const firstName = getFirstName(fullName);
  const downloads = getLatestDesktopDownloads();
  const body = buildApplicantOnboardingBody(firstName, downloads);

  MailApp.sendEmail({
    to: email,
    subject: "You're in -- Junior field study",
    body,
    name: SENDER_DISPLAY_NAME,
    replyTo: NOTIFICATION_EMAIL,
  });
}

function sendFieldStudyClosedEmail(email, fullName) {
  const firstName = getFirstName(fullName);
  const body = buildClosedStudyBody(firstName);

  MailApp.sendEmail({
    to: email,
    subject: 'Thanks for applying -- try Junior free',
    body,
    name: SENDER_DISPLAY_NAME,
    replyTo: NOTIFICATION_EMAIL,
  });
}

function buildClosedStudyBody(firstName) {
  return [
    `Hey ${firstName || 'there'},`,
    '',
    'Thanks for applying to the Junior field study. The group of 10 is now full.',
    '',
    'I built Junior to help job seekers like you start real conversations with hiring managers on LinkedIn -- instead of just submitting resumes and hoping for the best.',
    '',
    'You can try Junior free for 14 days. No credit card required.',
    '',
    'Start your free trial here:',
    REGISTER_URL,
    '',
    'If you have any questions, just reply to this email.',
    '',
    'Andrew',
  ].join('\n');
}

function buildApplicantOnboardingBody(firstName, downloads) {
  const lines = [
    `Hey ${firstName || 'there'},`,
    '',
    "Thanks for applying. I'd like to include you in the Junior field study.",
    '',
    'Here are the next steps:',
    '',
    '1. Create your Junior account:',
    REGISTER_URL,
    '',
    '2. Download Junior Desktop:',
    `Windows: ${downloads.windows || DESKTOP_RELEASES_URL}`,
    `macOS Intel: ${downloads.macosIntel || DESKTOP_RELEASES_URL}`,
    `macOS Apple Silicon: ${downloads.macosArm || DESKTOP_RELEASES_URL}`,
    `All downloads: ${DESKTOP_RELEASES_URL}`,
    '',
    '3. Book a quick onboarding session with me:',
    ONBOARDING_CALENDLY_URL,
    '',
    '4. Before you start, reply to this email with "I\'m in" so I know you received this and can confirm your setup.',
    '',
    '5. Every Monday for 4 weeks, I will send a quick check-in. The check-in form is here:',
    WEEKLY_CHECK_IN_URL,
    '',
    "You'll receive 1 free year of Junior for participating.",
    '',
    'If you hit any setup issue, reply here and I will help.',
    `You can also reach me directly at ${NOTIFICATION_EMAIL}.`,
    '',
    'Andrew',
  ];

  return lines.join('\n');
}

function getLatestDesktopDownloads() {
  try {
    const response = UrlFetchApp.fetch(DESKTOP_RELEASES_API_URL, {
      muteHttpExceptions: true,
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      return {};
    }

    const release = JSON.parse(response.getContentText());
    const assets = release.assets || [];
    const windows = findAssetUrl(assets, /Junior[-.\s]Setup.*\.exe$/i);
    const macosIntel = findAssetUrl(assets, /Junior.*-x64\.dmg$/i) ||
      findAssetUrl(assets, /Junior.*\.dmg$/i, /arm64/i);
    const macosArm = findAssetUrl(assets, /Junior.*arm64.*\.dmg$/i);

    return {
      windows,
      macosIntel,
      macosArm,
    };
  } catch (err) {
    console.warn('Unable to fetch latest Desktop release:', err);
    return {};
  }
}

function findAssetUrl(assets, includePattern, excludePattern) {
  const asset = assets.find((item) => {
    const name = item.name || '';
    if (!includePattern.test(name)) {
      return false;
    }
    return !excludePattern || !excludePattern.test(name);
  });

  return asset ? asset.browser_download_url : '';
}

function getFirstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

function getAnswer(values, label) {
  const value = values[label];

  if (!value) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
}
