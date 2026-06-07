export const LEGAL_UPDATED_AT = 'May 29, 2026';

export const legalDocuments = [
  {
    id: 'terms',
    title: 'Terms of Use',
    kicker: 'Player contract',
    summary: 'The rules for using CRACKL, entering modes, earning Intel, and keeping the arena fair.',
    sections: [
      {
        title: 'Eligibility',
        body: [
          'You may use CRACKL only if you can legally enter a skill-based game in your location. Cash, rewards, wagers, or withdrawal-style features are only for users who are old enough and legally permitted to use them.',
          'You are responsible for following local laws. If a feature is restricted where you live, do not use that feature.'
        ]
      },
      {
        title: 'Account Responsibility',
        body: [
          'Keep your account credentials private. You are responsible for activity on your account unless CRACKL caused the compromise.',
          'One person should not operate multiple accounts to farm rewards, bypass limits, manipulate leaderboards, or enter the same contest more than allowed.'
        ]
      },
      {
        title: 'Skill-Based Gameplay',
        body: [
          'CRACKL is built around riddles, timing, logic, memory, pattern recognition, and decision-making. Results depend on player skill, not random chance alone.',
          'Riddles may be text, image, audio, interactive, timed, ranked, chained, wagered, or multiplayer. Mode-specific rules shown in the product apply to each run.'
        ]
      },
      {
        title: 'Intel, Rewards, and Wagers',
        body: [
          'Intel is an in-app balance used for gameplay, scorekeeping, challenges, and selected reward flows. Intel is not cash unless CRACKL explicitly offers a lawful redemption path for a specific campaign or feature.',
          'Blind Wager, Dead Heat, challenge links, Panic Mode bonuses, and any reward logic must be settled by the server. Client-side display bugs do not create a right to extra Intel or cash.'
        ]
      },
      {
        title: 'Fair Play',
        body: [
          'Do not use bots, automation, answer sharing systems, API abuse, replay attacks, packet manipulation, multiple accounts, or any exploit to gain an advantage.',
          'CRACKL may reverse rewards, lock accounts, remove leaderboard scores, void runs, or restrict access when cheating, abuse, or system manipulation is detected.'
        ]
      },
      {
        title: 'Content and Admin Review',
        body: [
          'Riddles, answers, media, hints, explanations, and challenge data may be reviewed, edited, archived, or removed to protect quality, legality, safety, and fairness.',
          'If a riddle is wrong, offensive, duplicated, or technically broken, report it instead of exploiting it.'
        ]
      },
      {
        title: 'Service Changes',
        body: [
          'CRACKL features, rewards, timers, scoring, mode rules, and availability can change as the product evolves.',
          'We may pause or limit features during maintenance, security incidents, fraud review, legal review, or infrastructure failures.'
        ]
      }
    ]
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    kicker: 'Data handling',
    summary: 'What CRACKL collects, why it is collected, how it is protected, and what choices users have.',
    sections: [
      {
        title: 'Data We Collect',
        body: [
          'Account data such as username, email, avatar, location fields you provide, authentication records, and admin/support interactions.',
          'Gameplay data such as riddles served, answers submitted, timing, streaks, Intel changes, ranks, challenge links, reports, tickets, wagers, and multiplayer room activity.',
          'Technical data such as API requests, readiness checks, device/browser information, error logs, abuse signals, storage metadata, and security audit records.'
        ]
      },
      {
        title: 'Why We Use Data',
        body: [
          'To run gameplay, prevent duplicate riddles, maintain progression, verify answers, settle wagers, show accurate stats, protect against cheating, and operate support/admin tools.',
          'To improve reliability, debug crashes, detect abuse, secure accounts, and understand whether the product is working correctly.'
        ]
      },
      {
        title: 'AI Answer Checking',
        body: [
          'Some riddles may use AI-assisted answer review only when that option is enabled by an admin for that specific riddle.',
          'When AI review is enabled, the submitted answer and riddle context may be processed to decide whether the meaning matches. Exact-answer riddles do not need AI review.'
        ]
      },
      {
        title: 'Storage and Media',
        body: [
          'Images, audio, video, and interactive assets uploaded by admins may be stored in Supabase Storage and shown to users as part of riddle gameplay.',
          'User avatars may be stored or cached to display profile identity across the app.'
        ]
      },
      {
        title: 'Sharing',
        body: [
          'We do not sell personal data. Data may be shared with infrastructure providers, authentication providers, analytics/security tools, payment or reward processors when enabled, and legal authorities when required.',
          'Challenge links may expose limited gameplay context such as the puzzle, target time, challenger name, or result needed for the challenge experience.'
        ]
      },
      {
        title: 'Retention and Security',
        body: [
          'Gameplay and audit records may be retained to protect fairness, resolve disputes, prevent fraud, and maintain progression history.',
          'CRACKL uses access controls, server-side validation, protected database views, and service-role-only operations for sensitive data. No system is perfectly secure.'
        ]
      }
    ]
  },
  {
    id: 'fairplay',
    title: 'Fair Play Rules',
    kicker: 'Arena integrity',
    summary: 'How scores, answers, wagers, multiplayer rooms, and technical failures should be handled.',
    sections: [
      {
        title: 'Answer Rules',
        body: [
          'For exact-answer riddles, the answer entered by the admin is the required answer. Capitalization and harmless spacing may be normalized by the system.',
          'For semantic-answer riddles, CRACKL may accept equivalent meaning when the admin enabled AI answer checking for that riddle.'
        ]
      },
      {
        title: 'Timed Runs',
        body: [
          'When Panic Mode is enabled, the run is timed using the admin-configured timer. No Panic Mode means no timer unless a specific mode says otherwise.',
          'If the timer expires, the run may count as failed, timed out, or settled according to the mode rules.'
        ]
      },
      {
        title: 'Wagers and Multiplayer',
        body: [
          'A user cannot wager more Intel than their available balance. Wager settlements are valid only after server confirmation.',
          'In multiplayer, the host-selected room settings apply. Players should not be able to change mode, timer, or wager state after the room starts except through allowed flows.'
        ]
      },
      {
        title: 'Technical Failures',
        body: [
          'If a network failure, duplicate riddle, missing media, or broken asset affects a run, CRACKL may void, replay, or manually adjust the run based on server logs.',
          'Screenshots alone are helpful for support, but final settlement depends on backend records.'
        ]
      },
      {
        title: 'Prohibited Conduct',
        body: [
          'No bots, answer databases, shared solver accounts, reverse engineering, traffic replay, database probing, harassment, threats, illegal content, or attempts to bypass restrictions.',
          'No uploading or submitting content that infringes rights, exposes private information, contains malware, or targets protected groups.'
        ]
      }
    ]
  },
  {
    id: 'rewards',
    title: 'Rewards Policy',
    kicker: 'Intel and cashback',
    summary: 'How Intel, bonuses, wagers, prizes, and possible redemption flows should be understood.',
    sections: [
      {
        title: 'Intel Balance',
        body: [
          'Intel is primarily an in-app gameplay balance. It can increase through correct answers, streaks, Panic Mode bonuses, challenges, admin campaigns, or multiplayer wins.',
          'Intel can decrease through wagers, failed Blind Wagers, selected mode entry costs, hints, or other game mechanics shown before confirmation.'
        ]
      },
      {
        title: 'No Guaranteed Cash Value',
        body: [
          'Unless CRACKL clearly offers a lawful redemption feature for a specific user, region, and campaign, Intel has no guaranteed cash value and cannot be sold, transferred, or redeemed outside the app.',
          'Reward availability can vary by region, eligibility, fraud review, tax rules, payment provider limits, and legal restrictions.'
        ]
      },
      {
        title: 'Adjustments',
        body: [
          'CRACKL may correct balances caused by bugs, duplicate settlement, exploit behavior, failed payments, chargebacks, or admin error.',
          'Suspicious reward activity may be paused for review before any payout or withdrawal-style action is processed.'
        ]
      }
    ]
  },
  {
    id: 'safety',
    title: 'Community Safety',
    kicker: 'User conduct',
    summary: 'Rules for usernames, avatars, chat-like features, reports, support tickets, and shared challenge links.',
    sections: [
      {
        title: 'Identity and Profiles',
        body: [
          'Usernames and avatars must not impersonate others, include hate or harassment, expose private information, or mislead users into thinking you are staff.',
          'CRACKL may rename, hide, or suspend accounts that violate identity rules.'
        ]
      },
      {
        title: 'Reports and Support',
        body: [
          'Use reporting and support tools for incorrect riddles, offensive content, bugs, account problems, reward disputes, or suspected cheating.',
          'False reports, spam, threats, or abusive support messages can lead to restrictions.'
        ]
      },
      {
        title: 'Challenge Links',
        body: [
          'Challenge links are meant for direct competitive invites. Do not use them for spam, phishing, harassment, or misleading promotions.',
          'Anyone opening a challenge link may see the challenge context needed to play or compare performance.'
        ]
      }
    ]
  }
];

export const legalQuickNotes = [
  'This product uses server records as the source of truth for scoring, Intel, wagers, timers, and reward settlement.',
  'AI answer checking is opt-in per riddle from admin controls; exact-answer riddles remain exact-answer riddles.',
  'Before public launch, replace contact and entity details with your final legal company details and have counsel review these policies.'
];
