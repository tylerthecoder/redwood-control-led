#!/bin/bash
curl -X GET http://localhost:3000/api/cron \
  -H "User-Agent: vercel-cron/1.0" \
  -H "Content-Type: application/json" \
  -v