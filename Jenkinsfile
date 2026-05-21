pipeline {
    agent any

    environment {
        APP_NAME = "Fullstack-App"

        // Production AWS EC2 instance where frontend + backend + MySQL run together
        PROD_SERVER = "32.199.180.220"
        SSH_USER = "ec2-user"          // Ubuntu AMI = ubuntu, Amazon Linux = ec2-user
        SSH_KEY = "/var/lib/jenkins/.ssh/id_ed25519"

        APP_BASE = "/var/www/fullstack-app"
        BACKEND_BASE = "/var/www/fullstack-app/backend"
        FRONTEND_BASE = "/var/www/fullstack-app/frontend"
        SHARED_ENV = "/var/www/fullstack-app/shared/.env"

        BACKEND_PORT = "5000"
        HEALTH_ENDPOINT = "/health"
        AUTH_CHECK_ROUTE = "/api/orders"

        SONAR_PROJECT_KEY = "fullstack-node-mysql-app"
        SONAR_PROJECT_NAME = "Fullstack Node MySQL App"

        CI_MYSQL_CONTAINER = "ci-mysql-fullstack"
        CI_MYSQL_ROOT_PASS = "ci_root_pass_123"
        CI_MYSQL_DB = "testdb"
        CI_MYSQL_USER = "ci_user"
        CI_MYSQL_PASS = "ci_pass_123"
        CI_MYSQL_PORT = "3307"

        CI_JWT_SECRET = "ci-jwt-secret-minimum-32-chars-long-for-testing"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
    }

    triggers { githubPush() }

    stages {
        stage('Clean Workspace') { steps { cleanWs() } }
        stage('Checkout Code') { steps { checkout scm } }

        stage('Detect Branch') {
            steps {
                sh '''
                    set -e
                    BRANCH="${BRANCH_NAME:-${GIT_BRANCH#origin/}}"
                    BRANCH="${BRANCH#refs/heads/}"
                    BRANCH="${BRANCH#refs/remotes/origin/}"
                    BRANCH="${BRANCH#origin/}"
                    echo "$BRANCH" > .current_branch
                    echo "Current branch: $BRANCH"
                    if [ "$BRANCH" = "main" ]; then
                        echo "main branch: CI + SonarQube + Production Deploy"
                    else
                        echo "$BRANCH branch: CI + SonarQube only. No deploy."
                    fi
                '''
            }
        }

        stage('Backend - Install Dependencies') {
            steps {
                dir('backend') {
                    sh '''
                        set -e
                        node --version
                        npm --version
                        if [ -f package-lock.json ]; then npm ci; else npm install; fi
                    '''
                }
            }
        }

        stage('Frontend - Install Dependencies') {
            steps {
                dir('frontend') {
                    sh '''
                        set -e
                        node --version
                        npm --version
                        if [ -f package-lock.json ]; then npm ci; else npm install; fi
                    '''
                }
            }
        }

        stage('Start MySQL for CI') {
            steps {
                sh '''
                    set -e
                    docker rm -f ${CI_MYSQL_CONTAINER} 2>/dev/null || true
                    docker run -d \
                      --name ${CI_MYSQL_CONTAINER} \
                      -e MYSQL_ROOT_PASSWORD=${CI_MYSQL_ROOT_PASS} \
                      -e MYSQL_DATABASE=${CI_MYSQL_DB} \
                      -e MYSQL_USER=${CI_MYSQL_USER} \
                      -e MYSQL_PASSWORD=${CI_MYSQL_PASS} \
                      -p ${CI_MYSQL_PORT}:3306 \
                      --health-cmd="mysqladmin ping -uroot -p${CI_MYSQL_ROOT_PASS} --silent" \
                      --health-interval=3s \
                      --health-timeout=5s \
                      --health-retries=20 \
                      mysql:8.0

                    for i in $(seq 1 40); do
                        STATUS=$(docker inspect --format='{{.State.Health.Status}}' ${CI_MYSQL_CONTAINER} 2>/dev/null || echo starting)
                        if [ "$STATUS" = "healthy" ]; then echo "MySQL is healthy"; exit 0; fi
                        echo "MySQL status: $STATUS ($i/40)"; sleep 3
                    done
                    docker logs ${CI_MYSQL_CONTAINER} || true
                    exit 1
                '''
            }
        }

        stage('Backend - Import Check') {
            environment {
                NODE_ENV = "test"
                PORT = "0"
                DB_HOST = "127.0.0.1"
                DB_PORT = "3307"
                DB_NAME = "testdb"
                DB_USER = "ci_user"
                DB_PASS = "ci_pass_123"
                JWT_SECRET = "${CI_JWT_SECRET}"
            }
            steps { dir('backend') { sh 'node -e "require(\'./src/app\'); console.log(\'Backend import OK\')"' } }
        }

        stage('Backend - Run Jest Tests') {
            environment {
                NODE_ENV = "test"
                PORT = "0"
                DB_HOST = "127.0.0.1"
                DB_PORT = "3307"
                DB_NAME = "testdb"
                DB_USER = "ci_user"
                DB_PASS = "ci_pass_123"
                JWT_SECRET = "${CI_JWT_SECRET}"
                JEST_JUNIT_OUTPUT_DIR = "test-results"
                JEST_JUNIT_OUTPUT_NAME = "backend-results.xml"
            }
            steps { dir('backend') { sh 'mkdir -p test-results && npm run test:ci' } }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/test-results/*.xml'
                    publishHTML(target: [allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true, reportDir: 'backend/coverage/lcov-report', reportFiles: 'index.html', reportName: 'Backend Coverage Report'])
                }
            }
        }

        stage('Frontend - Build') { steps { dir('frontend') { sh 'npm run build' } } }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube') {
                    sh '''
                        set -e
                        sonar-scanner \
                          -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                          -Dsonar.projectName="${SONAR_PROJECT_NAME}" \
                          -Dsonar.sources=backend/src,frontend/src \
                          -Dsonar.tests=backend/tests \
                          -Dsonar.exclusions="**/node_modules/**,**/coverage/**,**/dist/**,**/build/**,**/test-results/**" \
                          -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info \
                          -Dsonar.host.url=$SONAR_HOST_URL
                    '''
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps { timeout(time: 10, unit: 'MINUTES') { waitForQualityGate abortPipeline: true } }
        }

        stage('Prepare Release on Production Server') {
            when { expression { sh(script: "cat .current_branch", returnStdout: true).trim() == "main" } }
            steps {
                sh '''
                    set -e
                    RELEASE_ID="$(date +%Y%m%d%H%M%S)-${BUILD_NUMBER}"
                    echo "$RELEASE_ID" > .release_id
                    rsync -az --delete --exclude '.git' --exclude 'node_modules' --exclude 'coverage' --exclude 'test-results' --exclude '.env*' \
                      -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" ./ ${SSH_USER}@${PROD_SERVER}:/tmp/${APP_NAME}-${RELEASE_ID}/

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e
                        mkdir -p ${BACKEND_BASE}/releases/${RELEASE_ID} ${FRONTEND_BASE}/releases/${RELEASE_ID} ${APP_BASE}/shared
                        rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/backend/ ${BACKEND_BASE}/releases/${RELEASE_ID}/
                        if [ -d /tmp/${APP_NAME}-${RELEASE_ID}/frontend/dist ]; then
                            rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/frontend/dist/ ${FRONTEND_BASE}/releases/${RELEASE_ID}/
                        elif [ -d /tmp/${APP_NAME}-${RELEASE_ID}/frontend/build ]; then
                            rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/frontend/build/ ${FRONTEND_BASE}/releases/${RELEASE_ID}/
                        else
                            echo 'ERROR: Frontend build output not found'; exit 1
                        fi
                        cd ${BACKEND_BASE}/releases/${RELEASE_ID}
                        npm ci --omit=dev 2>/dev/null || npm install --production
                        set -a && . ${SHARED_ENV} && set +a
                        node -e 'require(\"./src/app\"); console.log(\"Production backend import OK\")'
                    "
                '''
            }
        }

        stage('Pre-Deploy Smoke Test') {
            when { expression { sh(script: "cat .current_branch", returnStdout: true).trim() == "main" } }
            steps {
                sh '''
                    set -e
                    RELEASE_ID="$(cat .release_id)"
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e
                        cd ${BACKEND_BASE}/releases/${RELEASE_ID}
                        set -a && . ${SHARED_ENV} && set +a
                        export PORT=19000
                        rm -f /tmp/fullstack-smoke.pid /tmp/fullstack-smoke.log
                        nohup node src/server.js > /tmp/fullstack-smoke.log 2>&1 & echo \$! > /tmp/fullstack-smoke.pid
                        for i in \$(seq 1 25); do
                            if curl -fsS http://127.0.0.1:19000${HEALTH_ENDPOINT} >/dev/null; then
                                kill \$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
                                echo 'Smoke test health OK'; exit 0
                            fi
                            sleep 2
                        done
                        cat /tmp/fullstack-smoke.log || true
                        kill \$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
                        exit 1
                    "
                '''
            }
        }

        stage('Deploy to Production') {
            when { expression { sh(script: "cat .current_branch", returnStdout: true).trim() == "main" } }
            steps {
                sh '''
                    set -e
                    RELEASE_ID="$(cat .release_id)"
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e
                        PREV_BACKEND=\$(readlink -f ${BACKEND_BASE}/current 2>/dev/null || echo '')
                        PREV_FRONTEND=\$(readlink -f ${FRONTEND_BASE}/current 2>/dev/null || echo '')
                        ln -sfn ${BACKEND_BASE}/releases/${RELEASE_ID} ${BACKEND_BASE}/current
                        ln -sfn ${FRONTEND_BASE}/releases/${RELEASE_ID} ${FRONTEND_BASE}/current
                        sudo systemctl daemon-reload
                        sudo systemctl restart node-backend
                        sleep 5
                        for i in \$(seq 1 20); do
                            if curl -fsS http://127.0.0.1:${BACKEND_PORT}${HEALTH_ENDPOINT} >/dev/null; then
                                sudo systemctl reload nginx || sudo systemctl restart nginx
                                echo 'Production deployment successful'; exit 0
                            fi
                            sleep 3
                        done
                        echo 'Health failed. Rolling back...'
                        if [ -n \"\$PREV_BACKEND\" ]; then ln -sfn \$PREV_BACKEND ${BACKEND_BASE}/current; fi
                        if [ -n \"\$PREV_FRONTEND\" ]; then ln -sfn \$PREV_FRONTEND ${FRONTEND_BASE}/current; fi
                        sudo systemctl restart node-backend
                        exit 1
                    "
                '''
            }
        }

        stage('Post Deploy Verification') {
            when { expression { sh(script: "cat .current_branch", returnStdout: true).trim() == "main" } }
            steps {
                sh '''
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e
                        sudo systemctl is-active --quiet node-backend
                        sudo systemctl is-active --quiet nginx
                        curl -fsS http://127.0.0.1:${BACKEND_PORT}${HEALTH_ENDPOINT} >/dev/null
                        echo 'Backend, Nginx and health check are OK'
                    "
                '''
            }
        }

        stage('Cleanup Old Releases') {
            when { expression { sh(script: "cat .current_branch", returnStdout: true).trim() == "main" } }
            steps {
                sh '''
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        ls -dt ${BACKEND_BASE}/releases/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
                        ls -dt ${FRONTEND_BASE}/releases/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
                        rm -rf /tmp/${APP_NAME}-* 2>/dev/null || true
                    " || true
                '''
            }
        }
    }

    post {
        always { sh 'docker rm -f ${CI_MYSQL_CONTAINER} 2>/dev/null || true' }
        success { echo 'SUCCESS: CI, SonarQube and branch-based deployment completed.' }
        failure { echo 'FAILED: Pipeline stopped. Production deployment was blocked or rolled back.' }
    }
}
