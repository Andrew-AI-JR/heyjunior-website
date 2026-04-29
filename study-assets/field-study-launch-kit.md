# Junior Field Study Launch Kit

## Links

- Intake application form: `https://docs.google.com/forms/d/e/1FAIpQLSctKVqaEAWJwIPK8C2lEvqD3cTZ0DXvGl7-Kyi4g0I6mPvUJg/viewform`
- Intake edit form: `https://docs.google.com/forms/d/1J7CeQA2l46CoxVhXt5C_dQqdE9_IEBLrGqI-Pzm5OI8/edit`
- Weekly check-in form: `https://docs.google.com/forms/d/e/1FAIpQLSc9c_g8yTNU3JtZordsEJ5plsI1wHw2yG2pUjFlrjPFjlGdXg/viewform`
- Weekly edit form: `https://docs.google.com/forms/d/1ZQt_gFkmAO7OUUvJ4v3FzPXFpP6M6lPHY4ECwF17eWE/edit`
- Response sheet: `https://docs.google.com/spreadsheets/d/1RTtRVWYWdOCWRaJowlPFkx-W5U2fzBU5ti7jO-3eIXE/edit?gid=1789588965#gid=1789588965`
- LinkedIn image: `study-assets/junior-field-study-linkedin.png`
- Apps Script Postmark routing (production): `study-assets/field-study-response-routing-postmark.gs`
- Apps Script Gmail routing (fallback -- trigger removed): `study-assets/field-study-response-routing.gs`
- Apps Script full form-builder fallback: `study-assets/field-study-form-builder.gs`

## LinkedIn Post

I'm recruiting 10 job seekers for a small field study.

I built Junior because I was tired of applying to hundreds of jobs and hearing nothing. Junior helps you find relevant hiring posts on LinkedIn and write personalized comments based on your background and the post -- so you start conversations instead of just submitting resumes.

I'm looking for 10 people to use Junior during their real job search for 4 weeks and share honest feedback about what actually happens.

Who I'm looking for:
- early-career tech/data/software job seekers
- recent grads looking for their first or next role
- recently laid-off tech workers actively searching

What you'll get:
- 1 free year of Junior
- early access to the workflow we're building
- a direct line to shape the product around real job-search pain

What I'm asking:
- use Junior as part of your real job search for 4 weeks
- answer a short weekly check-in (5 questions, 2 minutes)
- tell me what works, what doesn't, and what should change

This is not a marketing stunt. I want to watch what happens when real people use this in the field -- with real posts, real constraints, and real outcomes.

Spots are limited. Once 10 people are selected, the form stays open for a waitlist.

Apply here: https://docs.google.com/forms/d/e/1FAIpQLSctKVqaEAWJwIPK8C2lEvqD3cTZ0DXvGl7-Kyi4g0I6mPvUJg/viewform

If you know someone who's actively job searching in tech, tag them. This might actually help.

## Short Repost / Comment

Looking for 10 active tech/data/software job seekers to try Junior free for 1 year in exchange for 4 weeks of honest feedback.

Best fit: recent grads, early-career job seekers, and recently laid-off tech workers.

Apply here: https://docs.google.com/forms/d/e/1FAIpQLSctKVqaEAWJwIPK8C2lEvqD3cTZ0DXvGl7-Kyi4g0I6mPvUJg/viewform

Tag someone who's job searching right now.

## Selected Participant Email

Subject: You're in -- Junior field study

Hey {{first_name}},

Thanks for applying. I'd like to include you in the group of 10 for the Junior field study.

Here's what happens next:

1. Create your Junior account and download Junior Desktop using the setup links I send.
2. Book a quick onboarding session with me: https://calendly.com/andrew_malinow_phd
3. Every Monday for 4 weeks, I'll send a quick check-in (5 questions, 2 minutes): https://docs.google.com/forms/d/e/1FAIpQLSc9c_g8yTNU3JtZordsEJ5plsI1wHw2yG2pUjFlrjPFjlGdXg/viewform
4. At the end, there's a short exit survey, and you can optionally hop on a 20-minute Zoom call.

You'll receive 1 free year of Junior for participating.

If you're still in, reply "I'm in" and I'll send access details within 24 hours.
You can also reach me directly at andrew@heyjunior.ai.

Andrew

## Study Full / Closed Email (automated)

This email is sent automatically by the Postmark Apps Script when the field study reaches 10 accepted participants.

Subject: Thanks for applying -- try Junior free

Hey {{first_name}},

Thanks for applying to the Junior field study. The group of 10 is now full.

I built Junior to help job seekers like you start real conversations with hiring managers on LinkedIn -- instead of just submitting resumes and hoping for the best.

You can try Junior free for 14 days. No credit card required.

Start your free trial here: https://heyjunior.ai/register.html?src=field-study

If you have any questions, just reply to this email.

Andrew

## Weekly Check-In Email

Subject: Junior field study weekly check-in

Hey {{first_name}},

Quick weekly check-in for the Junior field study. It should take about 2 minutes:

https://docs.google.com/forms/d/e/1FAIpQLSc9c_g8yTNU3JtZordsEJ5plsI1wHw2yG2pUjFlrjPFjlGdXg/viewform

The most useful feedback is specific: what happened, what felt useful, what felt awkward, and whether any conversations started.

Andrew

## Verification

- Intake form public URL loaded successfully.
- Weekly check-in form public URL loaded successfully.
- Test application submitted successfully.
- Test response appeared in the linked response sheet.
- Apps Script `sendFieldStudyNotification` trigger executed successfully after the test response.
- Inbox delivery to `andrew@heyjunior.ai` was not directly verified because inbox access was unavailable.
