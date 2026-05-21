# Fullstack Node.js + MySQL + React/Angular CI/CD Project

Prepared for:
- Frontend: React or Angular
- Backend: Node.js + Express
- Database: MySQL
- Production: frontend + backend + MySQL on one AWS EC2 instance
- CI/CD: Jenkins and SonarQube running on another AWS EC2 instance

## Branch Strategy

| Branch | CI Tests | SonarQube | Deploy |
|---|---:|---:|---:|
| feature/* | Yes | Yes | No |
| dev | Yes | Yes | No |
| preprod | Yes | Yes | No |
| main | Yes | Yes | Yes |

## Change Before Use

In `Jenkinsfile`, update:

```groovy
PROD_SERVER = "YOUR_PROD_SERVER_IP"
SSH_USER = "ubuntu"
```

For Amazon Linux use:

```groovy
SSH_USER = "ec2-user"
```

## Production Server Setup

Copy this repo to the production AWS instance once, then run:

```bash
sudo bash deploy/production-server-setup.sh
sudo nano /var/www/fullstack-app/shared/.env
```

## Jenkins Webhook

GitHub repo → Settings → Webhooks → Add webhook:

```text
http://YOUR_JENKINS_PUBLIC_IP:8080/github-webhook/
```

Content type: `application/json`

Event: `Just the push event`

## Jenkins Plugins Required

- Pipeline
- GitHub Branch Source
- SonarQube Scanner
- JUnit
- HTML Publisher
- Workspace Cleanup

## SonarQube Jenkins Name

In Jenkins → Manage Jenkins → System → SonarQube servers, keep the name exactly:

```text
sonarqube
```
