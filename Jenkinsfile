pipeline {
    agent any

    environment {
        APP_NAME = "Fullstack-App"

        // Production AWS EC2 instance where frontend + backend + MySQL run together
        // IMPORTANT: Update PROD_SERVER before running main branch deployment.
        PROD_SERVER = "100.31.148.237"
        SSH_USER = "ec2-user"          // Amazon Linux = ec2-user, Ubuntu = ubuntu
        SSH_KEY = "/var/lib/jenkins/.ssh/id_ed25519"

        // Must match your production EC2 setup and node-backend.service
        APP_BASE = "/var/www/app"
        BACKEND_BASE = "/var/www/app/backend"
        FRONTEND_BASE = "/var/www/app/frontend"
        SHARED_ENV = "/var/www/app/shared/.env"

        BACKEND_PORT = "5000"
        HEALTH_ENDPOINT = "/health"
        AUTH_CHECK_ROUTE = "/api/orders"

        SONAR_PROJECT_KEY = "fullstack-node-mysql-app"
        SONAR_PROJECT_NAME = "Fullstack Node MySQL App"

        // CI MySQL credentials. Host port is dynamic, not fixed.
        CI_MYSQL_ROOT_PASS = "ci_root_pass_123"
        CI_MYSQL_DB = "testdb"
        CI_MYSQL_USER = "ci_user"
        CI_MYSQL_PASS = "ci_pass_123"

        // Old fixed name kept only for non-blocking legacy cleanup
        CI_MYSQL_CONTAINER = "ci-mysql-fullstack"

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

                    CI_MYSQL_RUNTIME_CONTAINER="ci-mysql-fullstack-${BUILD_NUMBER}"
                    echo "$CI_MYSQL_RUNTIME_CONTAINER" > .ci_mysql_container

                    echo "Starting MySQL CI container: $CI_MYSQL_RUNTIME_CONTAINER"

                    # Remove same-build container if it exists
                    docker rm -f "$CI_MYSQL_RUNTIME_CONTAINER" 2>/dev/null || true

                    # Non-blocking cleanup of stopped old CI containers only
                    docker ps -a \
                      --filter "name=ci-mysql-fullstack" \
                      --filter "status=exited" \
                      --format "{{.Names}}" | while read old_container; do
                        if [ -n "$old_container" ]; then
                            echo "Removing stopped old MySQL container: $old_container"
                            docker rm -f "$old_container" 2>/dev/null || true
                        fi
                    done

                    echo "Starting MySQL with dynamic host port to avoid port conflicts..."

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

                    for i in $(seq 1 40); do
                        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CI_MYSQL_RUNTIME_CONTAINER" 2>/dev/null || echo starting)

                        if [ "$STATUS" = "healthy" ]; then
                            echo "MySQL is healthy"
                            break
                        fi

                        echo "MySQL status: $STATUS ($i/40)"
                        sleep 3

                        if [ "$i" = "40" ]; then
                            echo "ERROR: MySQL did not become healthy"
                            docker logs "$CI_MYSQL_RUNTIME_CONTAINER" || true
                            exit 1
                        fi
                    done

                    CI_MYSQL_HOST_PORT="$(docker port "$CI_MYSQL_RUNTIME_CONTAINER" 3306/tcp | sed 's/.*://')"

                    if [ -z "$CI_MYSQL_HOST_PORT" ]; then
                        echo "ERROR: Could not detect MySQL mapped host port."
                        docker logs "$CI_MYSQL_RUNTIME_CONTAINER" || true
                        exit 1
                    fi

                    echo "$CI_MYSQL_HOST_PORT" > .ci_mysql_port
                    echo "MySQL dynamic host port: $CI_MYSQL_HOST_PORT"
                '''
            }
        }

        stage('Backend - Import Check') {
            steps {
                dir('backend') {
                    sh '''
                        set -e

                        export NODE_ENV="test"
                        export PORT="0"
                        export DB_HOST="127.0.0.1"
                        export DB_PORT="$(cat ../.ci_mysql_port)"
                        export DB_NAME="${CI_MYSQL_DB}"
                        export DB_USER="${CI_MYSQL_USER}"
                        export DB_PASS="${CI_MYSQL_PASS}"
                        export JWT_SECRET="${CI_JWT_SECRET}"

                        echo "Backend import check using DB_PORT=$DB_PORT"
                        node -e "require('./src/app'); console.log('Backend import OK')"
                    '''
                }
            }
        }

        stage('Backend - Run Jest Tests') {
            steps {
                dir('backend') {
                    sh '''
                        set -e

                        export NODE_ENV="test"
                        export PORT="0"
                        export DB_HOST="127.0.0.1"
                        export DB_PORT="$(cat ../.ci_mysql_port)"
                        export DB_NAME="${CI_MYSQL_DB}"
                        export DB_USER="${CI_MYSQL_USER}"
                        export DB_PASS="${CI_MYSQL_PASS}"
                        export JWT_SECRET="${CI_JWT_SECRET}"
                        export JEST_JUNIT_OUTPUT_DIR="test-results"
                        export JEST_JUNIT_OUTPUT_NAME="backend-results.xml"

                        echo "Running backend tests using DB_PORT=$DB_PORT"

                        mkdir -p test-results

                        if [ -f package.json ] && grep -q '"test:ci"' package.json; then
                            npm run test:ci
                        else
                            npx jest \
                              --forceExit \
                              --detectOpenHandles \
                              --coverage \
                              --coverageReporters=lcov \
                              --coverageReporters=text \
                              --reporters=default \
                              --reporters=jest-junit
                        fi
                    '''
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/test-results/*.xml'
                    archiveArtifacts artifacts: 'backend/coverage/**,backend/test-results/*.xml', allowEmptyArchive: true
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

                        SONAR_ARGS=""
                        if [ -f "backend/coverage/lcov.info" ]; then
                            SONAR_ARGS="$SONAR_ARGS -Dsonar.javascript.lcov.reportPaths=backend/coverage/lcov.info"
                        fi

                        sonar-scanner \
                          -Dsonar.projectKey=${SONAR_PROJECT_KEY} \
                          -Dsonar.projectName="${SONAR_PROJECT_NAME}" \
                          -Dsonar.sources=backend/src,frontend/src \
                          -Dsonar.tests=backend/tests \
                          -Dsonar.exclusions="**/node_modules/**,**/coverage/**,**/dist/**,**/build/**,**/test-results/**" \
                          -Dsonar.host.url=$SONAR_HOST_URL \
                          $SONAR_ARGS
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
                        echo "Branch is main. Deployment stages will run."
                    else
                        echo "Branch is $CURRENT_BRANCH. CI and SonarQube completed. Deployment skipped."
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

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e

                        BACKEND_RELEASE_DIR='${BACKEND_BASE}/releases/${RELEASE_ID}'

                        mkdir -p \\$BACKEND_RELEASE_DIR ${BACKEND_BASE}/shared ${APP_BASE}/shared ${FRONTEND_BASE}

                        rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/backend/ \\$BACKEND_RELEASE_DIR/

                        cd \\$BACKEND_RELEASE_DIR

                        if [ -f package-lock.json ]; then
                            npm ci --omit=dev
                        else
                            npm install --production
                        fi

                        set -a && . ${SHARED_ENV} && set +a

                        node -e 'require(\"./src/app\"); console.log(\"Production backend import OK\")'

                        echo 'Release ${RELEASE_ID} prepared successfully.'
                    "
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

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e

                        BACKEND_RELEASE_DIR='${BACKEND_BASE}/releases/${RELEASE_ID}'

                        cd \\$BACKEND_RELEASE_DIR

                        set -a && . ${SHARED_ENV} && set +a
                        export PORT=19000

                        rm -f /tmp/fullstack-smoke.pid /tmp/fullstack-smoke.log

                        nohup node src/server.js > /tmp/fullstack-smoke.log 2>&1 &
                        echo \\$! > /tmp/fullstack-smoke.pid

                        STARTED=false

                        for i in \\$(seq 1 25); do
                            if curl -fsS http://127.0.0.1:19000${HEALTH_ENDPOINT} >/dev/null 2>&1; then
                                STARTED=true
                                echo 'Smoke test health OK'
                                break
                            fi

                            echo 'Waiting for smoke test app... '\\$i'/25'
                            sleep 2
                        done

                        if [ \"\\$STARTED\" != 'true' ]; then
                            echo 'ERROR: Smoke test failed'
                            cat /tmp/fullstack-smoke.log || true
                            kill \\$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
                            rm -f /tmp/fullstack-smoke.pid
                            exit 1
                        fi

                        kill \\$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
                        rm -f /tmp/fullstack-smoke.pid

                        echo 'Pre-deploy smoke test passed.'
                    "
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

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e

                        BACKEND_RELEASE_DIR='${BACKEND_BASE}/releases/${RELEASE_ID}'
                        PREV_BACKEND=\\$(readlink -f ${BACKEND_BASE}/current 2>/dev/null || echo '')

                        if [ ! -d \\$BACKEND_RELEASE_DIR ]; then
                            echo 'ERROR: Backend release directory missing.'
                            exit 1
                        fi

                        ln -sfn \\$BACKEND_RELEASE_DIR ${BACKEND_BASE}/current

                        sudo systemctl daemon-reload
                        sudo systemctl restart node-backend

                        sleep 5

                        HEALTH_OK=false

                        for i in \\$(seq 1 20); do
                            if curl -fsS http://127.0.0.1:${BACKEND_PORT}${HEALTH_ENDPOINT} >/dev/null 2>&1; then
                                HEALTH_OK=true
                                echo 'Production backend health check passed.'
                                break
                            fi

                            echo 'Production health retry '\\$i'/20'
                            sleep 3
                        done

                        if [ \"\\$HEALTH_OK\" != 'true' ]; then
                            echo 'ERROR: Backend health failed. Rolling back...'

                            if [ -n \"\\$PREV_BACKEND\" ] && [ -d \"\\$PREV_BACKEND\" ]; then
                                ln -sfn \\$PREV_BACKEND ${BACKEND_BASE}/current
                                sudo systemctl restart node-backend
                                echo 'Rollback completed.'
                            else
                                echo 'No previous backend release available for rollback.'
                            fi

                            exit 1
                        fi

                        # Deploy frontend static files only after backend is healthy.
                        if [ -d /tmp/${APP_NAME}-${RELEASE_ID}/frontend/dist ]; then
                            rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/frontend/dist/ ${FRONTEND_BASE}/
                        elif [ -d /tmp/${APP_NAME}-${RELEASE_ID}/frontend/build ]; then
                            rsync -az --delete /tmp/${APP_NAME}-${RELEASE_ID}/frontend/build/ ${FRONTEND_BASE}/
                        else
                            echo 'ERROR: Frontend build output not found.'
                            exit 1
                        fi

                        sudo systemctl reload nginx || sudo systemctl restart nginx

                        echo 'Production deployment successful.'
                    "
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
                    set -e

                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e

                        sudo systemctl is-active --quiet node-backend
                        echo 'node-backend service is active.'

                        sudo systemctl is-active --quiet nginx
                        echo 'nginx service is active.'

                        ss -tulnp | grep ':${BACKEND_PORT}' >/dev/null
                        echo 'Backend port ${BACKEND_PORT} is listening.'

                        curl -fsS http://127.0.0.1:${BACKEND_PORT}${HEALTH_ENDPOINT} >/dev/null
                        echo 'Backend health is OK.'

                        curl -fsS http://127.0.0.1${HEALTH_ENDPOINT} >/dev/null || true
                        echo 'Nginx health proxy check attempted.'

                        echo 'Post deploy verification completed.'
                    "
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
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        set -e

                        ls -dt ${BACKEND_BASE}/releases/* 2>/dev/null | tail -n +6 | xargs -r rm -rf
                        rm -rf /tmp/${APP_NAME}-* 2>/dev/null || true
                        rm -f /tmp/fullstack-smoke.pid /tmp/fullstack-smoke.log 2>/dev/null || true

                        echo 'Cleanup completed.'
                    " || true
                '''
            }
        }
    }

    post {
        always {
            sh '''
                echo "Running final CI cleanup..."

                if [ -f .ci_mysql_container ]; then
                    CI_MYSQL_RUNTIME_CONTAINER="$(cat .ci_mysql_container)"
                    echo "Removing MySQL CI container: $CI_MYSQL_RUNTIME_CONTAINER"
                    docker rm -f "$CI_MYSQL_RUNTIME_CONTAINER" 2>/dev/null || true
                    rm -f .ci_mysql_container
                else
                    echo "No .ci_mysql_container file found."
                fi

                rm -f .ci_mysql_port 2>/dev/null || true

                # Legacy cleanup only. Non-blocking.
                docker rm -f ${CI_MYSQL_CONTAINER} 2>/dev/null || true

                CURRENT_BRANCH="${BRANCH_NAME:-${GIT_BRANCH#origin/}}"
                CURRENT_BRANCH="${CURRENT_BRANCH#refs/heads/}"
                CURRENT_BRANCH="${CURRENT_BRANCH#refs/remotes/origin/}"
                CURRENT_BRANCH="${CURRENT_BRANCH#origin/}"

                if [ "$CURRENT_BRANCH" = "main" ]; then
                    ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ${SSH_USER}@${PROD_SERVER} "
                        if [ -f /tmp/fullstack-smoke.pid ]; then
                            kill \\$(cat /tmp/fullstack-smoke.pid) 2>/dev/null || true
                            rm -f /tmp/fullstack-smoke.pid
                        fi

                        rm -f /tmp/fullstack-smoke.log || true
                    " || true
                else
                    echo "Non-main branch cleanup only. No production server cleanup needed."
                fi
            '''
        }

        success {
            echo "Pipeline SUCCESS. CI, SonarQube, and branch-based deployment completed."
        }

        failure {
            echo "Pipeline FAILED. Deployment was blocked or rollback was triggered where applicable."
        }

        aborted {
            echo "Pipeline ABORTED manually or by timeout. Dynamic MySQL cleanup was attempted."
        }
    }
}
