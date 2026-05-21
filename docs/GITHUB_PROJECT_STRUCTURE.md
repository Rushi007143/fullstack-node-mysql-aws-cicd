# GitHub Project Structure

```bash
fullstack-node-mysql-aws-cicd/
├── Jenkinsfile
├── README.md
├── .gitignore
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── sonar-project.properties
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/db.js
│   │   ├── middleware/auth.middleware.js
│   │   ├── routes/auth.routes.js
│   │   ├── routes/health.routes.js
│   │   ├── routes/orders.routes.js
│   │   ├── routes/users.routes.js
│   │   ├── routes/kpi.routes.js
│   │   └── utils/calculations.js
│   └── tests/
│       ├── setup.js
│       ├── helpers.js
│       ├── test_1_health.test.js
│       ├── test_2_auth.test.js
│       ├── test_3_api_responses.test.js
│       └── test_4_business_logic.test.js
├── frontend/
│   ├── .env.example
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       └── style.css
└── deploy/
    ├── nginx-site.conf
    ├── node-backend.service
    ├── production-server-setup.sh
    └── mysql-init.sql
```
