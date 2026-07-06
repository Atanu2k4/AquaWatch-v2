# AquaWatch

![React](https://img.shields.io/badge/React-18-blue?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-5.4-purple?logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-teal?logo=tailwindcss&logoColor=white) ![Firebase](https://img.shields.io/badge/Firebase-12-orange?logo=firebase&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-0.110-green?logo=fastapi&logoColor=white) ![Python](https://img.shields.io/badge/Python-3.13.7-yellow?logo=python&logoColor=white) ![DWLR](https://img.shields.io/badge/DWLR_Dataset-5260%2B_Stations-blue?logo=database&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-green) ![Status](https://img.shields.io/badge/Status-Active-success)

**Real-time Groundwater Monitoring System for India**

AquaWatch is a comprehensive web application that provides real-time monitoring and analysis of India's groundwater crisis across all states and union territories using Digital Water Level Recorder (DWLR) data from the Central Ground Water Board (CGWB).

The platform offers critical insights into groundwater depletion, water availability, and population impact through an intuitive dashboard powered by 5,260+ DWLR sensor stations across India.

> **Note:** India's groundwater is depleting at an alarming rate. AquaWatch empowers citizens, policymakers, and researchers with real-time data to combat this crisis.

---

## System Architecture

AquaWatch operates through 4 integrated phases:

1. **Data Acquisition**: 5,260+ DWLR Sensors (CGWB Data)
2. **Real-Time Processing**: FastAPI + Pandas (6-hour updates)
3. **Platform & App**: React Dashboard + Firebase Sync
4. **User Impact**: Citizens, Policymakers, Researchers

---

## Features

### Admin Dashboard
- **National Water Crisis Overview**: Real-time monitoring of states in crisis with DWLR statistics.
- **State-wise DWLR Analysis**: Detailed breakdown of water conditions across all 28 states and 8 UTs.
- **Interactive State Cards**: Clickable cards with historical water level charts.
- **Trend Analysis**: Up/down/stable water level trends from DWLR data (meters below ground level).
- **User Management**: Admin panel for managing users and monitoring engagement.
- **Real-time DWLR Sync**: Automatic updates from 5,260+ DWLR stations every 6 hours.

### User Dashboard
- **Personal Groundwater Monitoring**: Real-time tracking for the user's selected state.
- **Real-time Graphs**: Interactive charts with DWLR historical trends and water level forecasts.
- **Status Overview**: Visual indicators (Critical/Warning/Normal/Good) based on water level percentages.
- **Emergency Response**: Alerts panel and quick response procedures for groundwater crises.
- **Solutions & Resources**: Access to water management solutions, CGWB guidelines, and research data.

---

## Technology Stack

### Frontend
- **Framework**: React 19.2, TypeScript 5.5
- **Build Tool**: Vite 7.1
- **Styling**: Tailwind CSS, Styled-Components
- **State Management**: React Context API
- **Charting**: Recharts
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Authentication**: Firebase SDK

### Backend
- **Framework**: FastAPI, Python 3.13
- **Data Processing**: Pandas
- **Database**: Firebase Firestore
- **File Monitoring**: Watchdog
- **Server**: Uvicorn

---

## Getting Started

### Prerequisites

Ensure you have the following installed:
- Node.js (v18 or higher)
- Python 3.8+ (for optional backend API)
- npm or yarn package manager
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KGFCH2/AquaWatch_1.0.git
   cd AquaWatch_1.0
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```
   *(Note: If you encounter styled-components import errors, run `npm install styled-components @types/styled-components`)*

3. **Configure Environment Variables**
   Create a `.env` file in the `frontend` directory with your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:xxxxx
   ```

### Development

1. **Start the frontend development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Preview production build locally**
   ```bash
   npm run preview
   ```

### Backend API Server (Optional - For DWLR Sync)

The backend processes DWLR CSV data and syncs with Firebase. This is optional if you are only working on frontend UI.

1. **Install Python dependencies**
   ```bash
   cd ../backend
   pip install fastapi uvicorn pandas firebase-admin watchdog python-dotenv
   ```

2. **Prepare DWLR CSV data**
   Place `dwlr_india.csv` in the `backend/data/` directory.

3. **Configure Backend Environment**
   Create a `.env` file in the `backend` directory:
   ```env
   CSV_FILE=data/dwlr_india.csv
   FIREBASE_CREDENTIALS_PATH=path/to/serviceAccountKey.json
   COLLECTION_NAME=DWLR_state
   ```

4. **Start the FastAPI server**
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000`.

---

## Data Methodology

DWLR measurements are converted to percentage availability (0-100%):

- **0-30%**: Critical (Severe drought conditions)
- **31-50%**: High Stress (Significant stress, rationing needed)
- **51-70%**: Moderate (Monitoring required)
- **71-100%**: Good (Adequate water supply)

The backend performs multiple quality checks including completeness, format validation, range checks, deduplication, and incremental updates.

---

## Contributing

We welcome contributions from developers, data scientists, designers, and water experts!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/YourFeature`)
3. Commit your changes (`git commit -m 'Add YourFeature'`)
4. Push to the branch (`git push origin feature/YourFeature`)
5. Create a Pull Request

Please ensure you follow TypeScript strict mode, maintain code consistency, and write meaningful commit messages.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Central Ground Water Board (CGWB) for DWLR dataset and resources
- Ministry of Jal Shakti for policy and guidance
- Open Source Community

---

**Built for India's Water Security**
Monitoring Groundwater. Managing Crisis. Empowering Communities.