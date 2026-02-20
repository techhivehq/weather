🌦️ WeatherSphere — Intelligent Weather Dashboard

WeatherSphere is a production-ready, API-powered weather application designed to deliver real-time weather insights with a strong focus on performance, stability, personalization, and user experience.

This project showcases my ability to design a resilient frontend system, optimize API usage, manage user preferences, and deploy securely using modern workflows.

🔗 Live Demo

👉 Live App: https://weather-dun-delta.vercel.app

👉 GitHub Repo: https://github.com/techhivehq/weather

✨ Core Features

🌍 Weather Forecast & Visualization
📍 Real-time current weather data by city search or geolocation
🌡️ Hourly forecast displayed in a smooth, scrollable carousel
⏱️ 5-day forecast with daily summaries
📊 Temperature trend visualization using interactive charts
🌬️ Air Quality Index (AQI) gauge with contextual status indicators
🌓 Light & Dark Mode – Persisted theme with smooth transitions and system preference support
⚠️ Robust Error Handling – User-friendly messages for network issues, API errors, and invalid input

    
🎯 User Preference Storage & Personalization

Persisted light/dark theme preference
Stored last searched city for faster return visits
Saved temperature unit preference (°C / °F)
Preferences automatically restored on page reload using localStorage

This ensures a personalized, consistent experience across sessions.

⚙️ API Optimization & Rate Limit Management

Debounced search input to reduce unnecessary API calls
Cached responses to avoid repeated requests for the same city
Controlled fetch flow to prevent race conditions
Centralized API request handling for maintainability

These optimizations improve performance, reduce API usage, and protect against rate-limit exhaustion.

⚠️ Error Handling & Application Stability

Graceful handling of:
Invalid city names
Network failures
API errors and empty responses

Clear, user-friendly error messages instead of silent failures
Safe fallback states to prevent UI crashes

The app remains stable and predictable even under failure conditions.

⏳ Loading Indicators & Fallback States

Loading indicators displayed during API requests
Visual placeholders to prevent layout shifts
Disabled interactions during active fetch operations

This improves perceived performance and prevents user confusion.

🎨 UI Optimization & User Flow

Clean, accessible layout with semantic HTML
Smooth transitions for theme switching and UI updates
Optimized visual hierarchy for fast information scanning
Mobile-friendly interactions and scroll behavior

The UI is designed to guide users naturally from search → data → insights without friction.

🛠️ Tech Stack

Frontend

HTML5 (Semantic & accessible markup)
CSS3 (Custom styling, transitions, animations)
Vanilla JavaScript (ES6+)

Visualization

Chart.js (Temperature trends)

API

OpenWeather API (Weather, Forecast, Air Pollution)

Deployment & Security

Vercel (Hosting)
Serverless API proxy (API keys secured via environment variables)

🔐 API Key Security

API keys are never exposed on the client
Requests are routed through Vercel serverless functions
Secrets are managed using environment variables

This reflects real-world production security practices, not demo shortcuts.

🚀 Deployment Workflow

GitHub repository connected to Vercel
Automatic builds on push
Environment variables configured in Vercel dashboard
Serverless API endpoints act as a secure proxy layer

📁 Project Structure
/
├── index.html
├── styles.css
├── script.js
├── /api
│   ├── weather.js
│   ├── forecast.js
│   └── air-pollution.js
|   |__ reverse.js
|__ vercel.json


🧠 What This Project Demonstrates

Real-world API integration
User preference persistence
Defensive JavaScript and application stability
Performance-conscious API consumption
Secure frontend deployment
UX-focused UI and user flow design

📌 Future Enhancements

Favorite locations
Weather alerts & notifications
Progressive Web App (PWA) support
Automated testing for core logic

👤 Author

Kenneth Amobi
Frontend Developer
🔗 LinkedIn: https://www.linkedin.com/in/kenneth-amobi-06a9803a7
