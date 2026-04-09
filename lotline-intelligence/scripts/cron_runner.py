#!/usr/bin/env python3
"""
Cron scheduler for LotLine Intelligence data pipeline.

Run this as a background process to auto-refresh all data:
  python scripts/cron_runner.py

Schedule:
  Census ACS   → Monthly (1st of month)
  BLS LAUS     → Monthly (2nd of month)
  FEMA NFHL    → Quarterly (1st of Jan, Apr, Jul, Oct)
  Metrics calc → After each ingestion + nightly
"""

import schedule, time, subprocess, sys, logging
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger(__name__)


def run_script(name: str):
    log.info(f'Starting: {name}')
    result = subprocess.run(
        [sys.executable, f'scripts/{name}.py'],
        capture_output=True, text=True, timeout=600,
    )
    if result.returncode == 0:
        log.info(f'✅ Completed: {name}')
        if result.stdout:
            for line in result.stdout.strip().splitlines():
                log.info(f'  {line}')
    else:
        log.error(f'❌ Failed: {name}')
        log.error(result.stderr[-2000:] if result.stderr else 'No stderr')


def run_census():   run_script('ingest_census')
def run_bls():      run_script('ingest_bls');    run_script('calculate_metrics')
def run_fema():     run_script('ingest_fema');   run_script('calculate_metrics')
def run_metrics():  run_script('calculate_metrics')


# ─── Schedule ─────────────────────────────────────────────────────────────────
schedule.every().month.at('02:00').do(run_census)    # 2am monthly
schedule.every().month.at('03:00').do(run_bls)       # 3am monthly
schedule.every(90).days.at('04:00').do(run_fema)     # Quarterly
schedule.every().day.at('01:00').do(run_metrics)     # Nightly metric refresh

if __name__ == '__main__':
    log.info('🕐 LotLine Intelligence Cron Runner started')
    log.info('  Census ACS:  monthly')
    log.info('  BLS LAUS:    monthly')
    log.info('  FEMA NFHL:   quarterly')
    log.info('  Metrics:     nightly')

    # Run metrics immediately on startup to ensure fresh data
    run_metrics()

    while True:
        schedule.run_pending()
        time.sleep(60)
