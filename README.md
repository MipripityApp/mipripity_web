# Mipripity Web Application

A property voting and management platform that allows users to view, vote on, and manage property listings.

## Overview

Mipripity Web is a full-stack application with a React frontend and Express.js backend. The application allows users to:

- Browse property listings
- Vote on properties
- Manage user profiles
- Create and edit property listings (authorized users)
- View property details and statistics

## Tech Stack

- **Frontend**: React, Context API for state management
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: Firebase Authentication
- **Hosting**: Render

## Project Structure

```
mipripity_web/
├── src/                    # Server-side code
│   ├── backend/            # Backend implementation
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── migrations/     # Database migrations
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── utils/          # Utilities
│   │   └── server.js       # Express server setup
│   ├── frontend/           # Frontend implementation
│   │   ├── components/     # React components
│   │   ├── contexts/       # Context providers
│   │   ├── pages/          # Page components
│   │   ├── utils/          # Utility functions
│   │   ├── App.js          # Main App component
│   │   └── index.js        # Frontend entry point
│   ├── .env                # Environment variables
│   └── index.js            # Backend entry point
├── package.json            # Project dependencies and scripts
├── .gitignore              # Git ignore file
└── README.md               # Project documentation
```

## Prerequisites

- Node.js (v14 or later)
- PostgreSQL database
- Firebase project for authentication

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=mipripity

# Firebase
FIREBASE_TYPE=service_account
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="your-private-key"
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_X509_CERT_URL=your-cert-url
```

## Installation and Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/MipripityApp/mipripity_web.git
   cd mipripity_web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see above)

4. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment to Render

### Prerequisites

1. Create a Render account at [render.com](https://render.com)
2. Set up a PostgreSQL database service on Render
3. Configure environment variables in Render dashboard

### Deployment Steps

1. Connect your GitHub repository to Render
2. Create a Web Service with the following settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment Variables: Configure all the environment variables listed above
   - Auto-Deploy: Enable

3. Create a PostgreSQL database service or use an external database and configure the connection details in the environment variables.

4. Deploy the application and wait for the build to complete.

## Development Workflow

1. Create a new branch for your feature or bug fix
2. Make your changes
3. Test your changes locally
4. Submit a pull request to the main branch

## License

ISC