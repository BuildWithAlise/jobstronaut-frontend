#!/bin/bash
echo "🌐 Jobstronaut Frontend – Auto Push to Render"

cd ~/Desktop/Jobstronaut/jobstronaut-frontend || exit

git add .
git commit -m "💫 Auto-push Jobstronaut frontend update $(date '+%Y-%m-%d %H:%M:%S')"
git push origin main

echo "✅ Frontend pushed! Check Render → jobstronaut-frontend → Deploys tab."
