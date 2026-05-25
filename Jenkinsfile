pipeline {
    agent any

    environment {
        APP_NAME = "Fullstack-App"

        // Production AWS EC2 instance.
        // Your current production login is working with ec2-user, so keep this.
        PROD_SERVER = "54.85.200.56"
        SSH_USER = "ec2-user"
        SSH_KEY = "/var/lib/jenkins/.ssh/id_ed25519"

        // Production paths
        APP_BASE = "/var/www/app"
        BACKEND_BASE = "/var/www/app/backend"
        FRONTEND_BASE = "/var/www/app/frontend"
        SHARED_ENV = "/var/www/app/shared/.env"

        BACKEND_PORT = "5000"
        HEALTH_ENDPOINT = "/health"
        AUTH_CHECK_ROUTE = "/api/orders"

        SONAR_PROJECT_KEY = "fullstack-node-mysql-app"
        SONAR_PROJECT_NAME = "Fullstack Node MySQL App"

        // CI MySQL values
        CI_MYSQL_ROOT_PASS = "ci_root_pass_123"
        CI_MYSQL_DB = "testdb"
        CI_MYSQL_USER = "ci_user"
        CI_MYSQL_PASS = "ci_pass_123"

        CI_JWT_SECRET = "ci-jwt-secret-minimum-32-chars-long-for-testing"
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
    }

    triggers {
        githubPush()
    }

    stages {

        stage('Clean Workspace') {
            steps {
                cleanWs()
            }
        }

        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

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

                        if [ -f package-lock.json ]; then
                            npm ci
                        else
                            npm install
                        fi
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

                        if [ -f package-lock.json ]; then
                            npm ci
                        else
                            npm install
                        fi
                    '''
                }
            }
        }

        stage('Start MySQL for CI') {
            steps {
                sh '''
                    set -e

                    echo "Starting MySQL container with unique name and dynamic port..."

                    # Strong unique name avoids conflict even if an older build left a container behind.
                    UNIQUE_ID="$(date +%s)-${BUILD_NUMBER}-$$"
                    CI_MYSQL_RUNTIME_CONTAINER="ci-mysql-fullstack-${UNIQUE_ID}"

                    echo "$CI_MYSQL_RUNTIME_CONTAINER" > .ci_mysql_container
                    echo "CI MySQL container: $CI_MYSQL_RUNTIME_CONTAINER"

                    echo "Cleaning all old CI MySQL containers before starting new one..."
                    docker rm -f $(docker ps -aq --filter "name=ci-mysql-fullstack") 2>/dev/null || true

                    # Give Docker a few seconds to release old container names/resources.
                    sleep 3

                    docker run -d \
                      --name "$CI_MYSQL_RUNTIME_CONTAINER" \
                      -e MYSQL_ROOT_PASSWORD=${CI_MYSQL_ROOT_PASS} \
                      -e MYSQL_DATABASE=${CI_MYSQL_DB} \
                      -e MYSQL_USER=${CI_MYSQL_USER} \
                      -e MYSQL_PASSWORD=${CI_MYSQL_PASS} \
                      -p 127.0.0.1::3306 \
                      --health-cmd="mysqladmin ping -uroot -p${CI_MYSQL_ROOT_PASS} --silent" \
                      --health-interval=3s \
                      --health-timeout=5s \
                      --health-retries=20 \
                      mysql:8.0

                    echo "Waiting for MySQL to become healthy..."

                    for i in $(seq 1 40); do
                        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CI_MYSQL_RUNTIME_CONTAINER" 2>/dev/null || echo "starting")

                        if [ "$STATUS" = "healthy" ]; then
                            echo "MySQL is healthy."
                            break
                        fi

                        echo "MySQL status: $STATUS ($i/40)"
                        sleep 3

                        if [ "$i" = "40" ]; then
                            echo "ERROR: MySQL did not become healthy."
                            docker logs "$CI_MYSQL_RUNTIME_CONTAINER" || true
                            exit 1
                        fi
                    done

                    CI_MYSQL_PORT="$(docker port "$CI_MYSQL_RUNTIME_CONTAINER" 3306/tcp | head -1 | awk -F: '{print $NF}')"

                    if [ -z "$CI_MYSQL_PORT" ]; then
                        echo "ERROR: Could not detect dynamic MySQL port."
                        docker logs "$CI_MYSQL_RUNTIME_CONTAINER" || true
                        exit 1
                    fi

                    echo "$CI_MYSQL_PORT" > .ci_mysql_port

                    echo "Dynamic MySQL port is: $CI_MYSQL_PORT"
                    echo "MySQL CI connection: 127.0.0.1:$CI_MYSQL_PORT"
                '''
            }
        }

        stage('Backend - Import Check') {
            steps {
                dir('backend') {
                    sh '''
                        set -e

                        CI_MYSQL_PORT="$(cat ../.ci_mysql_port)"

                        export NODE_ENV="test"
                        export PORT="0"

                        export DB_HOST="127.0.0.1"
                        export DB_PORT="$CI_MYSQL_PORT"
                        export DB_NAME="${CI_MYSQL_DB}"
                        export DB_USER="${CI_MYSQL_USER}"
                        export DB_PASS="${CI_MYSQL_PASS}"

                        export MYSQL_HOST="127.0.0.1"
                        export MYSQL_PORT="$CI_MYSQL_PORT"
                        export MYSQL_DATABASE="${CI_MYSQL_DB}"
                        export MYSQL_USER="${CI_MYSQL_USER}"
                        export MYSQL_PASSWORD="${CI_MYSQL_PASS}"

                        export JWT_SECRET="${CI_JWT_SECRET}"

                        echo "Backend import check using MySQL port: $CI_MYSQL_PORT"

                        node - <<'NODECHECK'
require('./src/app');
console.log('Backend import OK');
NODECHECK
                    '''
                }
            }
        }

        stage('Backend - Run Jest Tests') {
            steps {
                dir('backend') {
                    sh '''
                        set -e

                        CI_MYSQL_PORT="$(cat ../.ci_mysql_port)"

                        export NODE_ENV="test"
                        export PORT="0"

                        export DB_HOST="127.0.0.1"
                        export DB_PORT="$CI_MYSQL_PORT"
                        export DB_NAME="${CI_MYSQL_DB}"
                        export DB_USER="${CI_MYSQL_USER}"
                        export DB_PASS="${CI_MYSQL_PASS}"

                        export MYSQL_HOST="127.0.0.1"
                        export MYSQL_PORT="$CI_MYSQL_PORT"
                        export MYSQL_DATABASE="${CI_MYSQL_DB}"
                        export MYSQL_USER="${CI_MYSQL_USER}"
                        export MYSQL_PASSWORD="${CI_MYSQL_PASS}"

                        export JWT_SECRET="${CI_JWT_SECRET}"

                        export JEST_JUNIT_OUTPUT_DIR="test-results"
                        export JEST_JUNIT_OUTPUT_NAME="backend-results.xml"

                        echo "Running Jest tests using MySQL port: $CI_MYSQL_PORT"

                        mkdir -p test-results
                        npm run test:ci
                    '''
                }
            }

            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/test-results/*.xml'
                    archiveArtifacts artifacts: 'backend/coverage/**', allowEmptyArchive: true
                    archiveArtifacts artifacts: 'backend/test-results/**', allowEmptyArchive: true
                }

                failure {
                    echo "Backend tests failed. Pipeline blocked."
                }
            }
        }

        stage('Frontend - Build') {
            steps {
                dir('frontend') {
                    sh '''
                        set -e
                        npm run build
                    '''
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('sonarqube') {
                    sh '''
                        set -e

                        echo "Running normal SonarQube analysis..."

                        # Normal SonarQube scan needs more memory than t2.micro.
                        # Recommended Jenkins size: t3.medium or higher.
                        export SONAR_SCANNER_OPTS="-Xmx1024m"

                        SONAR_ARGS=""

                        if [ -f "backend/coverage/lcov.info" ]; then
                            SONAR_ARGS="$SONAR_ARGS -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info"
                            echo "Coverage report found: backend/coverage/lcov.info"
                        else
                            echo "Coverage report not found. Continuing without coverage."
                        fi

                        sonar-scanner \
                          -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                          -Dsonar.projectName="${SONAR_PROJECT_NAME}" \
                          -Dsonar.sources=backend/src,frontend/src \
                          -Dsonar.tests=backend/tests \
                          -Dsonar.exclusions="**/node_modules/**,**/coverage/**,**/dist/**,**/build/**,**/test-results/**" \
                          -Dsonar.host.url=$SONAR_HOST_URL \
                          -Dsonar.javascript.node.maxspace=1024 \
                          $SONAR_ARGS

                        echo "SonarQube analysis completed."
                    '''
                }
            }
        }

        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Deployment Decision') {
            steps {
                sh '''
                    set -e

                    CURRENT_BRANCH="$(cat .current_branch)"

                    if [ "$CURRENT_BRANCH" = "main" ]; then
                        echo "Branch is main. Production deployment will run."
                    else
                        echo "Branch is $CURRENT_BRANCH."
                        echo "CI + SonarQube completed."
                        echo "Production deployment skipped for non-main branch."
                    fi
                '''
            }
        }

        stage('Prepare Release on Production Server') {
            when {
                expression {
                    return sh(script: "cat .current_branch", returnStdout: true).trim() == "main"
                }
            }

            steps {
                sh '''
                    set -e

                    RELEASE_ID="$(date +%Y%m%d%H%M%S)-${BUILD_NUMBER}"
                    echo "$RELEASE_ID" > .release_id

                    echo "Preparing release: $RELEASE_ID"

                    rsync -az --delete \
                      --exclude '.git' \
                      --exclude 'node_modules' \
                      --exclude 'coverage' \
                      --exclude 'test-results' \
                      --exclude '.env*' \
                      -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
                      ./ ${SSH_USER}@${PROD_SERVER}:/tmp/${APP_NAME}-${RELEASE_ID}/

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} <<ENDSSH
set -e

mkdir -p ${BACKEND_BASE}/releases/${RELEASE_ID}
mkdir -p ${FRONTEND_BASE}
mkdir -p ${APP_BASE}/shared

rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/backend/ ${BACKEND_BASE}/releases/${RELEASE_ID}/

if [ -d /tmp/${APP_NAME}-${RELEASE_ID}/frontend/dist ]; then
    rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/frontend/dist/ ${FRONTEND_BASE}/
elif [ -d /tmp/${APP_NAME}-${RELEASE_ID}/frontend/build ]; then
    rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/frontend/build/ ${FRONTEND_BASE}/
else
    echo "ERROR: Frontend build output not found."
    exit 1
fi

cd ${BACKEND_BASE}/releases/${RELEASE_ID}

npm ci --omit=dev 2>/dev/null || npm install --production

if [ ! -f ${SHARED_ENV} ]; then
    echo "ERROR: Production environment file missing: ${SHARED_ENV}"
    exit 1
fi

set -a
. ${SHARED_ENV}
set +a

node - <<'NODECHECK'
require('./src/app');
console.log('Production backend import OK');
NODECHECK

echo "Release prepared successfully."
ENDSSH
                '''
            }
        }

        stage('Pre-Deploy Smoke Test') {
            when {
                expression {
                    return sh(script: "cat .current_branch", returnStdout: true).trim() == "main"
                }
            }

            steps {
                sh '''
                    set -e

                    RELEASE_ID="$(cat .release_id)"

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} <<ENDSSH
set -e

cd ${BACKEND_BASE}/releases/${RELEASE_ID}

if [ ! -f ${SHARED_ENV} ]; then
    echo "ERROR: Production environment file missing: ${SHARED_ENV}"
    exit 1
fi

set -a
. ${SHARED_ENV}
set +a

export PORT=19000

rm -f /tmp/fullstack-smoke.pid /tmp/fullstack-smoke.log

nohup node src/server.js > /tmp/fullstack-smoke.log 2>&1 &
echo \\$! > /tmp/fullstack-smoke.pid

for i in \\$(seq 1 25); do
    if curl -fsS http://127.0.0.1:19000${HEALTH_ENDPOINT} >/dev/null; then
        echo "Smoke test health OK."
        kill \\$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
        rm -f /tmp/fullstack-smoke.pid
        exit 0
    fi

    echo "Waiting for smoke test app... \\$i/25"
    sleep 2
done

echo "Smoke test failed."
cat /tmp/fullstack-smoke.log || true
kill \\$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
rm -f /tmp/fullstack-smoke.pid
exit 1
ENDSSH
                '''
            }
        }

        stage('Deploy to Production') {
            when {
                expression {
                    return sh(script: "cat .current_branch", returnStdout: true).trim() == "main"
                }
            }

            steps {
                sh '''
                    set -e

                    RELEASE_ID="$(cat .release_id)"

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} <<ENDSSH
set -e

PREV_BACKEND=\\$(readlink -f ${BACKEND_BASE}/current 2>/dev/null || echo "")

ln -sfn ${BACKEND_BASE}/releases/${RELEASE_ID} ${BACKEND_BASE}/current

sudo systemctl daemon-reload
sudo systemctl restart node-backend

sleep 5

for i in \\$(seq 1 20); do
    if curl -fsS http://127.0.0.1:${BACKEND_PORT}${HEALTH_ENDPOINT} >/dev/null; then
        sudo systemctl reload nginx || sudo systemctl restart nginx
        echo "Production deployment successful."
        exit 0
    fi

    echo "Production health retry \\$i/20"
    sleep 3
done

echo "Health failed. Rolling back..."

if [ -n "\\$PREV_BACKEND" ]; then
    ln -sfn \\$PREV_BACKEND ${BACKEND_BASE}/current
fi

sudo systemctl restart node-backend

exit 1
ENDSSH
                '''
            }
        }

        stage('Post Deploy Verification') {
            when {
                expression {
                    return sh(script: "cat .current_branch", returnStdout: true).trim() == "main"
                }
            }

            steps {
                sh '''
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} <<ENDSSH
set -e

sudo systemctl is-active --quiet node-backend
sudo systemctl is-active --quiet nginx

curl -fsS http://127.0.0.1:${BACKEND_PORT}${HEALTH_ENDPOINT} >/dev/null

echo "Backend, Nginx and health check are OK."
ENDSSH
                '''
            }
        }

        stage('Cleanup Old Releases') {
            when {
                expression {
                    return sh(script: "cat .current_branch", returnStdout: true).trim() == "main"
                }
            }

            steps {
                sh '''
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} <<ENDSSH
set +e
ls -dt ${BACKEND_BASE}/releases/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
rm -rf /tmp/${APP_NAME}-* 2>/dev/null || true
rm -f /tmp/fullstack-smoke.pid /tmp/fullstack-smoke.log 2>/dev/null || true
echo "Cleanup completed."
ENDSSH
                '''
            }
        }
    }

    post {
        always {
            sh '''
                echo "Running final cleanup..."

                if [ -f .ci_mysql_container ]; then
                    CI_MYSQL_RUNTIME_CONTAINER="$(cat .ci_mysql_container)"
                    echo "Removing CI MySQL container: $CI_MYSQL_RUNTIME_CONTAINER"
                    docker rm -f "$CI_MYSQL_RUNTIME_CONTAINER" 2>/dev/null || true
                    rm -f .ci_mysql_container
                else
                    echo "No .ci_mysql_container file found."
                fi

                echo "Removing any remaining old CI MySQL containers..."
                docker rm -f $(docker ps -aq --filter "name=ci-mysql-fullstack") 2>/dev/null || true

                rm -f .ci_mysql_port || true
            '''
        }

        success {
            echo "SUCCESS: CI, SonarQube and branch-based deployment completed."
        }

        failure {
            echo "FAILED: Pipeline stopped. Production deployment was blocked or rolled back."
        }

        aborted {
            echo "ABORTED: Pipeline was manually stopped or timed out."
        }
    }
}
