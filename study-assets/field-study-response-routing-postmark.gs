const NOTIFICATION_EMAIL = 'andrew@heyjunior.ai';
const SENDER_DISPLAY_NAME = 'Andrew from Junior';
const POSTMARK_TOKEN_PROPERTY = 'POSTMARK_SERVER_TOKEN';
const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email';
const POSTMARK_FROM = 'Andrew from Junior <andrew@heyjunior.ai>';
const POSTMARK_MESSAGE_STREAM = 'outbound';
const WEEKLY_CHECK_IN_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc9c_g8yTNU3JtZordsEJ5plsI1wHw2yG2pUjFlrjPFjlGdXg/viewform';
const REGISTER_URL = 'https://heyjunior.ai/register.html?src=field-study';
const ONBOARDING_CALENDLY_URL = 'https://calendly.com/andrew_malinow_phd';
const DESKTOP_RELEASES_API_URL = 'https://api.github.com/repos/Andrew-AI-JR/Desktop-Releases/releases/latest';
const DESKTOP_RELEASES_URL = 'https://github.com/Andrew-AI-JR/Desktop-Releases/releases/latest';
const SENT_AT_HEADER = 'Onboarding email sent at';
const SEND_STATUS_HEADER = 'Onboarding email status';
const FIELD_STUDY_CAPACITY = 10;

function myFunction(e) {
  if (e && (e.namedValues || e.range)) {
    return sendFieldStudyNotification(e);
  }
  return sendPendingApplicantOnboardingEmails();
}

function setupFieldStudyTrigger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'myFunction')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('myFunction')
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();
}

function countAcceptedApplicants(sheet) {
  const headers = getHeaders(sheet);
  const statusCol = findHeaderIndex(headers, SEND_STATUS_HEADER) + 1;
  if (!statusCol) {
    return 0;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  let count = 0;
  for (let i = 0; i < statuses.length; i += 1) {
    const s = String(statuses[i][0] || '');
    if (s.indexOf('sent: trigger') === 0 || s.indexOf('sent: backfill') === 0) {
      count += 1;
    }
  }
  return count;
}

function isStudyFull(sheet) {
  return countAcceptedApplicants(sheet) >= FIELD_STUDY_CAPACITY;
}

function sendPendingApplicantOnboardingEmails() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Form Responses 1') || spreadsheet.getActiveSheet();
  const data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    if (isStudyFull(sheet)) {
      return sendFieldStudyClosedPreviewToAndrew();
    }
    return sendApplicantOnboardingPreviewToAndrew();
  }

  const headers = data[0].map((header) => String(header || '').trim());
  const statusColumns = ensureStatusColumns(sheet, headers);
  let acceptedSoFar = countAcceptedApplicants(sheet);
  let sent = 0;
  let closed = 0;
  let skipped = 0;
  let failed = 0;

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    const row = data[rowIndex];
    const rowNumber = rowIndex + 1;
    const values = valuesFromRow(headers, row);
    const fullName = getFirstAnswer(values, ['Full name', 'Name']) || 'Unknown applicant';
    const applicantEmail = getEmailFromValues(values);
    const existingSentAt = row[statusColumns.sentAtCol - 1];
    const existingStatus = String(row[statusColumns.statusCol - 1] || '');

    if (!applicantEmail || existingSentAt || existingStatus.indexOf('sent:') === 0 || existingStatus.indexOf('closed:') === 0) {
      skipped += 1;
      continue;
    }

    if (/cursor test/i.test(fullName)) {
      markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'skipped: test row');
      skipped += 1;
      continue;
    }

    try {
      if (acceptedSoFar < FIELD_STUDY_CAPACITY) {
        sendApplicantOnboardingEmail(applicantEmail, fullName);
        markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'sent: backfill');
        acceptedSoFar += 1;
        sent += 1;
      } else {
        sendFieldStudyClosedEmail(applicantEmail, fullName);
        markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'closed: backfill');
        closed += 1;
      }
    } catch (err) {
      markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'failed: ' + err.message);
      failed += 1;
    }
  }

  if (sent === 0 && closed === 0 && failed === 0) {
    if (isStudyFull(sheet)) {
      return sendFieldStudyClosedPreviewToAndrew() + ' ' + skipped + ' applicant rows skipped because they were already handled.';
    }
    return sendApplicantOnboardingPreviewToAndrew() + ' ' + skipped + ' applicant rows skipped because they were already handled.';
  }

  return sent + ' onboarding emails sent. ' + closed + ' closed-study emails sent. ' + skipped + ' skipped. ' + failed + ' failed.';
}

function sendFieldStudyNotification(e) {
  const spreadsheet = e.source || SpreadsheetApp.getActiveSpreadsheet();
  const sheet = e.range ? e.range.getSheet() : spreadsheet.getActiveSheet();
  const rowNumber = e.range ? e.range.getRow() : 0;
  const values = e.namedValues || valuesFromSubmittedRow(sheet, rowNumber);
  const fullName = getFirstAnswer(values, ['Full name', 'Name']) || 'Unknown applicant';
  const applicantEmail = getEmailFromValues(values);
  const sheetUrl = spreadsheet ? spreadsheet.getUrl() : '';
  const statusColumns = rowNumber ? ensureStatusColumns(sheet, getHeaders(sheet)) : null;
  const studyFull = isStudyFull(sheet);

  sendInternalNotification(values, fullName, applicantEmail, sheetUrl, studyFull);

  if (!applicantEmail) {
    if (statusColumns) {
      markOnboardingStatus(sheet, rowNumber, statusColumns, '', 'failed: missing applicant email');
    }
    return;
  }

  try {
    if (!studyFull) {
      sendApplicantOnboardingEmail(applicantEmail, fullName);
      if (statusColumns) {
        markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'sent: trigger');
      }
    } else {
      sendFieldStudyClosedEmail(applicantEmail, fullName);
      if (statusColumns) {
        markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'closed: trigger');
      }
    }
  } catch (err) {
    if (statusColumns) {
      markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, 'failed: ' + err.message);
    }
    throw err;
  }
}

function sendInternalNotification(values, fullName, applicantEmail, sheetUrl, studyFull) {
  const tag = studyFull ? '[STUDY FULL]' : '[ACCEPTED]';
  const body = [
    'New Junior field study application received.',
    '',
    'Name: ' + fullName,
    'Email: ' + applicantEmail,
    'LinkedIn: ' + getFirstAnswer(values, ['LinkedIn profile URL']),
    'Location: ' + getFirstAnswer(values, ['Where are you located? (city/country)']),
    'Target roles: ' + getFirstAnswer(values, ['What roles are you targeting?']),
    'Currently looking: ' + getFirstAnswer(values, ['Are you currently looking for work?']),
    'Describes them: ' + getFirstAnswer(values, ['Which best describes you?']),
    'Search duration: ' + getFirstAnswer(values, ['How long have you been looking?']),
    'Applications last 30 days: ' + getFirstAnswer(values, ['About how many jobs have you applied to in the last 30 days?']),
    'Biggest frustration: ' + getFirstAnswer(values, ['What is your biggest job-search frustration right now?']),
    '4-week commitment: ' + getFirstAnswer(values, ['Would you be willing to use Junior during your real job search for 4 weeks?']),
    'Weekly feedback: ' + getFirstAnswer(values, ['Are you comfortable sharing weekly feedback (5 questions, takes 2 minutes)?']),
    'Exit interview: ' + getFirstAnswer(values, ['Are you open to a short exit survey and optional 20-minute Zoom interview at the end?']),
    '',
    'Open the response sheet: ' + sheetUrl,
  ].join('\n');

  sendPostmarkEmail(NOTIFICATION_EMAIL, tag + ' New field study application: ' + fullName, body, 'field-study-internal');
}

function sendApplicantOnboardingEmail(email, fullName) {
  const firstName = getFirstName(fullName);
  const downloads = getLatestDesktopDownloads();
  const textBody = buildApplicantOnboardingTextBody(firstName, downloads);
  const htmlBody = buildApplicantOnboardingHtmlBody(firstName, downloads);

  sendPostmarkEmail(email, "You're in -- Junior field study", textBody, 'field-study-onboarding', NOTIFICATION_EMAIL, htmlBody);
}

function sendApplicantOnboardingPreviewToAndrew() {
  const downloads = getLatestDesktopDownloads();
  const textBody = buildApplicantOnboardingTextBody('Andrew', downloads);
  const htmlBody = buildApplicantOnboardingHtmlBody('Andrew', downloads);

  sendPostmarkEmail(NOTIFICATION_EMAIL, "[Preview] You're in -- Junior field study", textBody, 'field-study-onboarding-preview', '', htmlBody);
  return 'Preview onboarding email sent to ' + NOTIFICATION_EMAIL + '.';
}

function sendFieldStudyClosedEmail(email, fullName) {
  const firstName = getFirstName(fullName);
  const textBody = buildClosedStudyTextBody(firstName);
  const htmlBody = buildClosedStudyHtmlBody(firstName);

  sendPostmarkEmail(email, 'Thanks for applying -- try Junior free', textBody, 'field-study-closed', NOTIFICATION_EMAIL, htmlBody);
}

function sendFieldStudyClosedPreviewToAndrew() {
  const textBody = buildClosedStudyTextBody('Andrew');
  const htmlBody = buildClosedStudyHtmlBody('Andrew');

  sendPostmarkEmail(NOTIFICATION_EMAIL, '[Preview] Thanks for applying -- try Junior free', textBody, 'field-study-closed-preview', '', htmlBody);
  return 'Preview closed-study email sent to ' + NOTIFICATION_EMAIL + '.';
}

function buildClosedStudyTextBody(firstName) {
  return [
    'Hey ' + (firstName || 'there') + ',',
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

function buildClosedStudyHtmlBody(firstName) {
  return [
    '<p>Hey ' + escapeHtml(firstName || 'there') + ',</p>',
    '<p>Thanks for applying to the Junior field study. The group of 10 is now full.</p>',
    '<p>I built Junior to help job seekers like you start real conversations with hiring managers on LinkedIn &mdash; instead of just submitting resumes and hoping for the best.</p>',
    '<p><strong>You can try Junior free for 14 days. No credit card required.</strong></p>',
    '<p>' + buildLinkHtml(REGISTER_URL, 'Start your free 14-day trial') + '</p>',
    '<p>If you have any questions, just reply to this email.</p>',
    '<p>Andrew</p>',
  ].join('\n');
}

function buildApplicantOnboardingTextBody(firstName, downloads) {
  return [
    'Hey ' + (firstName || 'there') + ',',
    '',
    "Thanks for applying. I'd like to include you in the Junior field study.",
    '',
    'Here are the next steps:',
    '',
    '1. Create your Junior account:',
    REGISTER_URL,
    '',
    '2. Download Junior Desktop:',
    'Windows: ' + (downloads.windows || DESKTOP_RELEASES_URL),
    'macOS Intel: ' + (downloads.macosIntel || DESKTOP_RELEASES_URL),
    'macOS Apple Silicon: ' + (downloads.macosArm || DESKTOP_RELEASES_URL),
    'All downloads: ' + DESKTOP_RELEASES_URL,
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
    'You can also reach me directly at ' + NOTIFICATION_EMAIL + '.',
    '',
    'Andrew',
  ].join('\n');
}

function buildApplicantOnboardingHtmlBody(firstName, downloads) {
  const windowsUrl = downloads.windows || DESKTOP_RELEASES_URL;
  const macosIntelUrl = downloads.macosIntel || DESKTOP_RELEASES_URL;
  const macosArmUrl = downloads.macosArm || DESKTOP_RELEASES_URL;

  return [
    '<p>Hey ' + escapeHtml(firstName || 'there') + ',</p>',
    "<p>Thanks for applying. I'd like to include you in the Junior field study.</p>",
    '<p>Here are the next steps:</p>',
    '<ol>',
    '<li><strong>Create your Junior account:</strong><br>' + buildLinkHtml(REGISTER_URL, 'Create your Junior account') + '</li>',
    '<li><strong>Download Junior Desktop:</strong><br>' +
      buildLinkHtml(windowsUrl, 'Download Junior for Windows') + '<br>' +
      buildLinkHtml(macosIntelUrl, 'Download Junior for macOS Intel') + '<br>' +
      buildLinkHtml(macosArmUrl, 'Download Junior for macOS Apple Silicon') + '<br>' +
      buildLinkHtml(DESKTOP_RELEASES_URL, 'View all Junior Desktop downloads') +
      '</li>',
    '<li><strong>Book a quick onboarding session with me:</strong><br>' + buildLinkHtml(ONBOARDING_CALENDLY_URL, 'Book onboarding with Andrew') + '</li>',
    '<li>Before you start, reply to this email with <strong>I&#39;m in</strong> so I know you received this and can confirm your setup.</li>',
    '<li>Every Monday for 4 weeks, I will send a quick check-in: ' + buildLinkHtml(WEEKLY_CHECK_IN_URL, 'Open the weekly check-in form') + '</li>',
    '</ol>',
    "<p>You'll receive 1 free year of Junior for participating.</p>",
    '<p>If you hit any setup issue, reply here and I will help.<br>' +
      'You can also reach me directly at ' + escapeHtml(NOTIFICATION_EMAIL) + '.</p>',
    '<p>Andrew</p>',
  ].join('\n');
}

function buildLinkHtml(url, label) {
  return '<a href="' + escapeHtml(url) + '">' + escapeHtml(label) + '</a>';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendPostmarkEmail(to, subject, textBody, tag, bcc, htmlBody) {
  const token = PropertiesService.getScriptProperties().getProperty(POSTMARK_TOKEN_PROPERTY);

  if (!token) {
    throw new Error('Missing script property: ' + POSTMARK_TOKEN_PROPERTY);
  }

  const payload = {
    From: POSTMARK_FROM,
    To: to,
    ReplyTo: NOTIFICATION_EMAIL,
    Subject: subject,
    TextBody: textBody,
    MessageStream: POSTMARK_MESSAGE_STREAM,
    Tag: tag || 'field-study',
  };

  if (bcc) {
    payload.Bcc = bcc;
  }

  if (htmlBody) {
    payload.HtmlBody = htmlBody;
  }

  const response = UrlFetchApp.fetch(POSTMARK_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Accept: 'application/json',
      'X-Postmark-Server-Token': token,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Postmark error ' + status + ': ' + text.slice(0, 500));
  }

  return JSON.parse(text || '{}');
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
    const macosIntel = findAssetUrl(assets, /Junior.*-x64\.dmg$/i) || findAssetUrl(assets, /Junior.*\.dmg$/i, /arm64/i);
    const macosArm = findAssetUrl(assets, /Junior.*arm64.*\.dmg$/i);

    return { windows, macosIntel, macosArm };
  } catch (err) {
    console.warn('Unable to fetch latest Desktop release:', err);
    return {};
  }
}

function ensureStatusColumns(sheet, headers) {
  const existingHeaders = headers.slice();
  let sentAtCol = findHeaderIndex(existingHeaders, SENT_AT_HEADER) + 1;
  let statusCol = findHeaderIndex(existingHeaders, SEND_STATUS_HEADER) + 1;

  if (!sentAtCol) {
    sentAtCol = existingHeaders.length + 1;
    sheet.getRange(1, sentAtCol).setValue(SENT_AT_HEADER);
    existingHeaders.push(SENT_AT_HEADER);
  }

  if (!statusCol) {
    statusCol = existingHeaders.length + 1;
    sheet.getRange(1, statusCol).setValue(SEND_STATUS_HEADER);
  }

  return { sentAtCol, statusCol };
}

function markOnboardingStatus(sheet, rowNumber, statusColumns, applicantEmail, status) {
  const now = new Date();
  const isSent = status.indexOf('sent:') === 0 || status.indexOf('closed:') === 0;
  sheet.getRange(rowNumber, statusColumns.sentAtCol).setValue(isSent ? now : '');
  sheet.getRange(rowNumber, statusColumns.statusCol).setValue(status + (applicantEmail ? ' (' + applicantEmail + ')' : ''));
}

function valuesFromSubmittedRow(sheet, rowNumber) {
  if (!sheet || !rowNumber) {
    return {};
  }

  const headers = getHeaders(sheet);
  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return valuesFromRow(headers, row);
}

function valuesFromRow(headers, row) {
  return headers.reduce((values, header, index) => {
    if (header) {
      values[header] = [row[index]];
    }
    return values;
  }, {});
}

function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((header) => String(header || '').trim());
}

function getEmailFromValues(values) {
  const exact = getFirstAnswer(values, ['Email address', 'Email Address', 'Email']);
  if (exact) {
    return exact;
  }

  const emailKey = Object.keys(values).find((key) => /email/i.test(key));
  return emailKey ? getValue(values[emailKey]) : '';
}

function getFirstAnswer(values, labels) {
  const keys = Object.keys(values || {});

  for (const label of labels) {
    const exactKey = keys.find((key) => normalizeLabel(key) === normalizeLabel(label));
    if (exactKey) {
      const value = getValue(values[exactKey]);
      if (value) {
        return value;
      }
    }
  }

  return '';
}

function getValue(value) {
  if (!value) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return String(value || '').trim();
}

function findHeaderIndex(headers, label) {
  return headers.findIndex((header) => normalizeLabel(header) === normalizeLabel(label));
}

function normalizeLabel(label) {
  return String(label || '').trim().replace(/\s+/g, ' ').toLowerCase();
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
