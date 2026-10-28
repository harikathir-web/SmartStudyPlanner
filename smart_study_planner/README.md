# FocusFlow — Smart Study Planner & Focus Dashboard

A responsive frontend portfolio project built with HTML, CSS, JavaScript, Chart.js, and browser localStorage.

## Features

- Create, edit, delete, complete and filter study tasks
- Search by task title, subject, or notes
- Set task priority, due date, and estimated duration
- Pomodoro-style focus timer with 25-minute focus, 5-minute short break, and 15-minute long break presets
- Log completed focus sessions
- Weekly focus activity chart
- Daily focus goal with progress indicator
- Responsive layout for desktop, tablet, and mobile
- Save tasks, focus sessions, and goal in localStorage

## Project files

```text
smart_study_planner/
├── index.html
├── style.css
├── script.js
└── README.md
```

## How to run

1. Extract the ZIP file.
2. Open the `smart_study_planner` folder in Visual Studio Code.
3. Open `index.html` in your browser, or use the VS Code Live Server extension.
4. An internet connection is needed to load Google Fonts and Chart.js from their CDNs. The rest of the planner runs in the browser.

## Important notes

- Data is saved only in the current browser on the current device. Clearing browser storage can remove it.
- The timer logs a focus session when a full focus timer finishes. Pausing or resetting does not log a session.
- This is a frontend-only demo. It does not include user accounts, cloud sync, or a backend.
- Do not store private or sensitive information in this demo.

## Suggested future improvements

- React component-based version
- Authentication and cloud database
- Weekly calendar view
- Export study history to CSV
- Custom focus duration
- Unit tests for date and task logic
